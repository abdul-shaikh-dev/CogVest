-- Run locally with Perfetto trace_processor query -f against the retained trace.
-- Restrict CPU detail to CogVest; the final query adds known rendering controls.
-- System traces can contain unrelated process data; do not publish raw traces.
SELECT t.name, ROUND(SUM(s.dur) / 1e6, 1) AS cpu_ms
FROM sched s
JOIN thread t USING (utid)
JOIN process p USING (upid)
WHERE p.name = 'com.abdulshaikh.cogvest' AND s.dur > 0
GROUP BY t.utid
ORDER BY cpu_ms DESC
LIMIT 12;

SELECT
  CASE WHEN s.name LIKE 'DrawFrames%' THEN 'DrawFrames' ELSE s.name END AS phase,
  COUNT(*) AS samples,
  ROUND(AVG(s.dur) / 1e6, 2) AS avg_ms,
  ROUND(MAX(s.dur) / 1e6, 2) AS max_ms
FROM slice s
JOIN thread_track tt ON s.track_id = tt.id
JOIN thread t USING (utid)
JOIN process p USING (upid)
WHERE p.name = 'com.abdulshaikh.cogvest' AND s.dur > 0
  AND (s.name IN ('dequeueBuffer', 'eglSwapBuffersWithDamageKHR')
       OR s.name LIKE 'DrawFrames%')
GROUP BY phase;

-- Nested phases above overlap: do not add their durations together.
SELECT t.name, ts.state, ROUND(SUM(ts.dur) / 1e6, 1) AS ms
FROM thread_state ts
JOIN thread t USING (utid)
JOIN process p USING (upid)
WHERE p.name = 'com.abdulshaikh.cogvest' AND ts.dur > 0
  AND t.name IN ('RenderThread', 'mqt_v_js')
GROUP BY t.name, ts.state
ORDER BY t.name, ms DESC;

-- FrameTimeline separates app deadlines from compositor/presentation misses.
-- App rows count surface slices; compositor rows count display slices. Do not
-- add these together. Empty output is missing evidence, not proof of no jank.
SELECT p.name AS process, a.jank_type, a.present_type, COUNT(*) AS timeline_slices
FROM actual_frame_timeline_slice a
JOIN process p USING (upid)
WHERE a.dur > 0 AND p.name IN (
  'com.abdulshaikh.cogvest', 'com.android.settings', '/system/bin/surfaceflinger'
)
GROUP BY p.name, a.jank_type, a.present_type
ORDER BY p.name, timeline_slices DESC;
