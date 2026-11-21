#!/bin/sh
# Answers the first line of the message on stdin the way claude -p --output-format stream-json
# does. The lines after it are kombinat's notes for the agent.
message=$(cat | head -n 1)
sleep 1
printf '%s\n' '{"type":"system","subtype":"init","session_id":"b5c1e2d4","model":"claude-opus-5-5","cwd":"/repo"}'
printf '{"type":"assistant","message":{"content":[{"type":"text","text":"You asked: %s"}]}}\n' "$message"
now=$(date +%s)
printf '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","unifiedWindows":{"five_hour":{"utilization":0.12,"resetsAt":%d},"seven_day":{"utilization":0.2,"resetsAt":%d}}}}\n' $((now + 7200)) $((now + 259200))
printf '%s\n' '{"type":"result","result":"Done","is_error":false,"num_turns":1,"duration_ms":1000}'
