import Image from "next/image";

import { createAgentImageSignedUrls } from "@/features/agents/runs/image-storage";

export async function AgentRunImages({
  imagePaths,
}: {
  imagePaths: string[];
}) {
  if (imagePaths.length === 0) return null;
  const urls = await createAgentImageSignedUrls(imagePaths);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {urls.map((url, i) => (
        <div
          className="relative overflow-hidden rounded-[14px] border"
          key={imagePaths[i]}
          style={{ borderColor: "var(--bv-line)" }}
        >
          <Image
            alt={`Generated image ${i + 1}`}
            className="size-full object-cover"
            height={1024}
            src={url}
            unoptimized
            width={1024}
          />
        </div>
      ))}
    </div>
  );
}
