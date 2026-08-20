/**
 * Detect an assistant reply that *describes* a tool call instead of making one.
 *
 * The Copilot CLI normally reports work as `tool.execution_start` events. In a
 * resumed session whose history already contains one of these malformed turns,
 * the model imitates the format and writes the call out as text:
 *
 *   create
 *   <parameter name="path">/path/to/index.html</parameter>
 *   <parameter name="file_text">&lt;!DOCTYPE html&gt;...</parameter>
 *   </create>
 *
 * Nothing runs, no file appears, and the raw markup is shown to the user as if
 * it were the answer. Captured live from a real session, not hypothesised.
 *
 * The check is deliberately narrow: `<parameter name="` is CLI tool-call
 * syntax and does not occur in ordinary prose. Fenced code is stripped first
 * so that a reply legitimately *quoting* this format in an example is not
 * mistaken for the failure.
 */

const PARAM_TAG = /<parameter\s+name\s*=\s*"/i

/** Remove fenced code blocks, where this markup may appear as a quoted example. */
function withoutFencedCode(content: string): string {
  return content.replace(/```[\s\S]*?(?:```|$)/g, '')
}

/**
 * True when the reply contains an unexecuted tool call.
 *
 * `executedToolCount` guards the common case: if tools really did run, the
 * same markup in the prose is a description of work that happened, not a
 * failure to do it.
 */
export function isUnexecutedToolCall(content: string, executedToolCount: number): boolean {
  if (executedToolCount > 0) return false
  if (!content) return false
  return PARAM_TAG.test(withoutFencedCode(content))
}
