import "server-only";

import { truncateForApiMessage } from "@/lib/http";
import { requireResumeContextText } from "@/lib/resume-context";
import {
  buildStaticResumeHeaderMarkdown,
  getResumeProfile,
  profileReadyForTailor,
  resumePdfDownloadBaseName,
  stripVertexBodyToSections,
} from "@/lib/resume-profile";
import { buildTailorResumePrompt } from "@/lib/tailor-resume-prompt";
import {
  generateVertexGeminiText,
  isVertexEnvConfigured,
} from "@/lib/vertex-genai";

/** Same cap as `/api/test-vertex` tailor responses (memory / JSON safety). */
export const MAX_TAILOR_MARKDOWN_CHARS = 450_000;

function prerequisitesError(message: string): Error {
  const e = new Error(message);
  e.name = "TailorPrerequisitesError";
  return e;
}

/**
 * Shared Vertex tailor path used by `/api/test-vertex` and the send-email pipeline.
 * Throws if Vertex, resume context, or admin profile are not ready.
 */
export async function tailorResumeMarkdown(
  jobDescription: string,
): Promise<{
  markdown: string;
  pdfDownloadBaseName: string;
  wasTruncated: boolean;
}> {
  if (!isVertexEnvConfigured()) {
    throw prerequisitesError(
      "The AI connection (Google Cloud) is not set up. Set GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in your .env file.",
    );
  }

  const jd = jobDescription.trim();
  if (!jd) {
    throw new Error("Job posting text is empty after trimming.");
  }

  let canonical: string;
  try {
    canonical = await requireResumeContextText();
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "No saved resume. Upload your resume under Settings first.";
    throw prerequisitesError(message);
  }

  const profile = await getResumeProfile();
  if (!profileReadyForTailor(profile)) {
    throw prerequisitesError(
      "Add your full name and first name under Settings before tailoring a resume.",
    );
  }

  const prompt = buildTailorResumePrompt(canonical, jd);
  const modelBody = await generateVertexGeminiText(prompt);
  const bodyOnly = stripVertexBodyToSections(modelBody);
  const headerMd = buildStaticResumeHeaderMarkdown(profile);
  let markdown =
    bodyOnly.length > 0
      ? `${headerMd}\n\n${bodyOnly}`
      : `${headerMd}\n\n${modelBody.trim()}`;

  let wasTruncated = false;
  if (markdown.length > MAX_TAILOR_MARKDOWN_CHARS) {
    markdown = truncateForApiMessage(markdown, MAX_TAILOR_MARKDOWN_CHARS);
    wasTruncated = true;
  }

  return {
    markdown,
    pdfDownloadBaseName: resumePdfDownloadBaseName(profile.firstName),
    wasTruncated,
  };
}
