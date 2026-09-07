-- Run locally with Perfetto trace_processor query -f against the retained trace.
-- Restrict results to CogVest; system traces can contain unrelated process data.
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
