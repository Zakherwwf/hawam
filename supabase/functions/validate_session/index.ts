import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch session and associated track points
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionErr || !session) {
      return new Response(
        JSON.stringify({ error: `Session not found: ${sessionErr?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: trackPoints, error: trackErr } = await supabase
      .from('track_points')
      .select('*')
      .eq('session_id', session_id)
      .order('recorded_at', { ascending: true });

    const reasons: string[] = [];

    // 1. Mock location check
    if (session.mock_location_detected) {
      reasons.push('Mock GPS location detected on client device');
    }

    // 2. Minimum effort check
    const durationSeconds = session.duration_s || session.moving_time_s || 0;
    const distanceMeters = Number(session.distance_m) || 0;

    if (session.protocol === 'transect') {
      if (durationSeconds < 300) {
        reasons.push('Transect duration below minimum 5 minutes (300 s)');
      }
      if (distanceMeters < 200) {
        reasons.push('Transect distance below minimum 200 meters');
      }
    } else if (session.protocol === 'stationary_point') {
      if (durationSeconds < 300) {
        reasons.push('Stationary point count duration below minimum 5 minutes (300 s)');
      }
    }

    // 3. Speed & teleport check on track points (CLAUDE.md §2.2: walking speed <= 15 km/h = 4.17 m/s)
    if (trackPoints && trackPoints.length > 1) {
      let speedViolations = 0;
      let mockPoints = 0;

      for (let i = 1; i < trackPoints.length; i++) {
        const prev = trackPoints[i - 1];
        const curr = trackPoints[i];

        if (curr.is_mock) mockPoints++;

        // Point-reported speed
        if (curr.speed && Number(curr.speed) > 4.17) {
          speedViolations++;
        }

        // Computed speed between timestamps
        const timeDeltaS =
          (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
        
        if (timeDeltaS > 0 && curr.location && prev.location) {
          // location is PostGIS geography point GeoJSON or coordinate array
          const currCoords = curr.location.coordinates || [];
          const prevCoords = prev.location.coordinates || [];
          if (currCoords.length === 2 && prevCoords.length === 2) {
            const distM = haversineMeters(prevCoords[1], prevCoords[0], currCoords[1], currCoords[0]);
            const calculatedSpeed = distM / timeDeltaS;
            if (calculatedSpeed > 4.17 && distM > 10) {
              speedViolations++;
            }
          }
        }
      }

      if (mockPoints > 0) {
        reasons.push(`${mockPoints} track points were flagged as mock coordinates`);
      }
      if (speedViolations > 3) {
        reasons.push(`Vehicle movement detected: ${speedViolations} segments exceeded 15 km/h walking limit`);
      }
    }

    // 4. Determine final validation status
    const status = reasons.length === 0 ? 'valid' : 'flagged';

    // Update session in database
    await supabase
      .from('sessions')
      .update({
        validation_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    return new Response(
      JSON.stringify({
        success: true,
        session_id,
        validation_status: status,
        reasons,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
