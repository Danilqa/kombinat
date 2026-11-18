#!/bin/sh
# Answers the message on stdin the way claude -p --output-format stream-json does.
message=$(cat)
sleep 1
printf '%s\n' '{"type":"system","subtype":"init","session_id":"b5c1e2d4","model":"claude-opus-5-5","cwd":"/repo"}'
printf '{"type":"assistant","message":{"content":[{"type":"text","text":"You asked: %s"}]}}\n' "$message"
printf '%s\n' '{"type":"result","result":"Done","is_error":false,"num_turns":1,"duration_ms":1000}'
