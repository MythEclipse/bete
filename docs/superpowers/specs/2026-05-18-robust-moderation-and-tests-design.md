# Design Spec: Robust Moderation & Test Improvements

**Date**: 2026-05-18  
**Topic**: Robust LLM Moderation Parsing, Capping Multimodal Attachments, and Fixing Dev/Streaming Tests

---

## 1. Goal & Context
The project contains an LLM-based content moderation system that analyzes Discord messages and their image attachments. Real-world utilization revealed several issues:
1. **Multimodal API Limits**: High numbers of image attachments in the target or surrounding context messages exceed API limits (e.g. Nemotron/Omni models cap at 8 images), triggering an HTTP 400 error.
2. **LLM Output Variance**: LLM responses containing reasoning processes, conversational preambles, or markdown wrappers fail to parse under the current naive brace-matching algorithm, yielding `No JSON object found` or `Response missing 'results' array`.
3. **Snowflake Precision Loss**: Snowflake IDs returned by the LLM sometimes suffer from floating-point rounding or formatting issues, preventing them from matching the original string-based target IDs.
4. **Dev/Streaming Test Failures**: Failing tests in `ytdlp.test.ts` and `playTranscode.test.ts` due to mismatched parameters and type assertions.

---

## 2. Architecture & Detailed Design

### A. Multimodal Attachment Filtering & Prioritization
In `src/moderation/llmModerationClient.ts`:
* Extract all image attachments.
* Sort and prioritize attachments:
  * Targets first: Attachments belonging to messages in the active `targets` list.
  * Context second: Attachments belonging to context messages, sorted by `created_at` descending (most recent first).
* Slice the resulting array to a maximum of **8 elements** to ensure we never hit model limits.
* If the list is empty, proceed with the existing transparent 1x1 dummy PNG fallback.

### B. Resilient JSON Extraction
Implement `extractJson` inside `src/moderation/llmModerationClient.ts`:
1. **Markdown Blocks**: Scan for code blocks using `/```(?:json)?\s*([\s\S]*?)\s*```/g`. Try to parse the first match yielding an object.
2. **Exhaustive Span Search**: If markdown parsing fails, locate the indices of all `{` and `}` characters in the string. Try all matching pairs, starting from the largest span to the smallest.
3. **Error Reporting**: If no candidate substring parses as an object, throw `No JSON object found in response`.

### C. Message ID Fuzzy Mapping
* Map `message_id` back to target IDs by stringifying and checking exact match.
* If not matched and the ID ends with `"00"` or contains `"e+"` (indicating exponential format or floating point precision loss), search `targetIds` for a prefix match (first 10 characters) and restore the original ID.

### D. Streaming & Dev Test Fixes
* **`tests/media/ytdlp.test.ts`**: Update the assertion to expect `--format best[protocol^=http]/best` to match the actual production code.
* **`tests/streaming/playTranscode.test.ts`**: Safely check if the input `readable` is an object and has the `.on` function before calling `readable.on("data", ...)`.

---

## 3. Test Plan & Expanded Coverage
We will implement dedicated unit tests in `tests/moderation/llmModerationClient.test.ts`:
1. **Image Capping & Prioritization**: Ensure image attachments are sorted correctly and capped at 8.
2. **Complex Conversational Content**: Verify extraction from messages wrapped in markdown, with leading/trailing text, and multiple code blocks.
3. **Reasoning Blocks**: Verify extraction when reasoning blocks contain separate `{` and `}` symbols.
4. **Precision Loss Scenarios**: Verify automatic correction of floating-point string representations of Snowflake IDs.

---

## 4. Success Criteria
* All tests pass successfully (`pnpm run test` exits with `0`).
* System remains highly resilient to formatting variance in LLM responses.
* No 400 Bad Request errors occur due to exceeding the maximum image attachment limit.
