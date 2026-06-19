/** Décode un en-tête MIME RFC 2047 (=?UTF-8?Q?...?=). */
export function decodeMimeHeader(value: string): string {
  if (!value.includes("=?")) return value;

  const decoded = value.replace(
    /=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g,
    (_full, _charset: string, encoding: string, text: string) => {
      if (encoding.toUpperCase() === "B") {
        return Buffer.from(text, "base64").toString("utf8");
      }
      const q = text.replace(/_/g, " ");
      return q.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      );
    }
  );

  return decoded.replace(/\s{2,}/g, " ").trim();
}
