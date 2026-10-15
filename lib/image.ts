// #region generate-image
import Replicate, { type FileOutput } from "replicate";

export const SAMPLE_IMAGE = "/sample.svg";

// One FLUX schnell image on Replicate ($0.003 each). Without REPLICATE_API_TOKEN the app returns a bundled sample
// image instead, so you can try the credit flow without a Replicate account.
export async function generateImage(prompt: string): Promise<string> {
  if (!process.env.REPLICATE_API_TOKEN) return SAMPLE_IMAGE;

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const [image] = (await replicate.run("black-forest-labs/flux-schnell", {
    input: { prompt, num_outputs: 1, output_format: "webp" },
  })) as FileOutput[];
  return image.url().href;
}
// #endregion
