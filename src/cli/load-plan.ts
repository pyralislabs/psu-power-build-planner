import { readFileSync, statSync } from "node:fs";

const MAX_INPUT_BYTES = 1_048_576;

export class InputReadError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InputReadError";
    this.code = code;
  }
}

export function readPlanFile(path: string): unknown {
  let stat;
  try {
    stat = statSync(path);
  } catch (err) {
    throw new InputReadError(
      "INPUT_READ_ERROR",
      `Cannot stat input file: ${(err as Error).message}`,
    );
  }
  if (!stat.isFile()) {
    throw new InputReadError("INPUT_READ_ERROR", `Input path is not a regular file: ${path}`);
  }
  if (stat.size > MAX_INPUT_BYTES) {
    throw new InputReadError(
      "INPUT_TOO_LARGE",
      `Input file exceeds ${MAX_INPUT_BYTES} bytes (${stat.size}).`,
    );
  }
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new InputReadError(
      "INPUT_READ_ERROR",
      `Cannot read input file: ${(err as Error).message}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new InputReadError(
      "INPUT_PARSE_ERROR",
      `Input is not valid JSON: ${(err as Error).message}`,
    );
  }
}

export async function readStdin(): Promise<unknown> {
  if (process.stdin.isTTY) {
    throw new InputReadError("INPUT_READ_ERROR", "No input file provided and stdin is a TTY.");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const max = MAX_INPUT_BYTES;
  for await (const chunk of process.stdin) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > max) {
      throw new InputReadError("INPUT_TOO_LARGE", `Stdin input exceeds ${max} bytes.`);
    }
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new InputReadError(
      "INPUT_PARSE_ERROR",
      `Stdin input is not valid JSON: ${(err as Error).message}`,
    );
  }
}
