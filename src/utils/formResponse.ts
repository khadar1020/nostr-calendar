import type { Event as NostrEvent } from "nostr-tools";
import { signerManager } from "../common/signer";

function isResponseTag(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value[0] === "response" &&
    typeof value[1] === "string"
  );
}

export async function extractFormResponseTags(
  response: NostrEvent,
  formPubkey: string,
): Promise<string[][]> {
  const inlineTags = response.tags.filter(
    (tag) => tag[0] === "response" && typeof tag[1] === "string",
  );
  if (inlineTags.length > 0) {
    return inlineTags;
  }

  if (!response.content) {
    return [];
  }

  const signer = await signerManager.getSigner();
  if (!signer.nip44Decrypt) {
    return [];
  }

  try {
    const decrypted = await signer.nip44Decrypt(formPubkey, response.content);
    const parsed = JSON.parse(decrypted);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isResponseTag);
  } catch (error) {
    console.error("[formResponse] Failed to decrypt response event", error);
    return [];
  }
}
