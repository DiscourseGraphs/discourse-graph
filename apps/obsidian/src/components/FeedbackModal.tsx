import { App, Modal, Notice, requestUrl, setIcon } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { StrictMode, useState, useRef, useEffect } from "react";
import type DiscourseGraphPlugin from "~/index";

const FEEDBACK_ENDPOINT = `${process.env.NEXT_API_ROOT}/feedback`;

type FeedbackType = "feedback" | "bug_report" | "feature_request";

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug_report: "Bug report",
  feature_request: "Feature request",
  feedback: "Feedback",
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (!base64) {
        reject(new Error("Failed to read file as base64"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fieldClass =
  "w-full bg-modifier-form-field border border-modifier-border rounded text-normal px-3 py-2 text-sm box-border";

const selectClass = `${fieldClass} appearance-none h-9 leading-none`;

const accentButtonClass =
  "flex items-center justify-center gap-1.5 bg-accent text-on-accent rounded py-2.5 px-3 text-sm font-medium border-none cursor-pointer hover:opacity-90";

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type FeedbackContentProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

const FeedbackContent = ({ plugin, onClose }: FeedbackContentProps) => {
  const [email, setEmail] = useState(plugin.settings.username ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug_report");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError && (!value.trim() || isValidEmail(value.trim()))) {
      setEmailError(null);
    }
  };

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError(null);
    }
  };

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScreenshot(e.target.files?.[0] ?? null);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isSubmittable =
    title.trim().length > 0 &&
    email.trim().length > 0 &&
    isValidEmail(email.trim()) &&
    !emailError;

  const handleSubmit = async () => {
    if (!isSubmittable) return;

    setIsSubmitting(true);
    try {
      const screenshotBase64 = screenshot
        ? await readFileAsBase64(screenshot)
        : undefined;

      const payload = {
        email: email.trim() || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        type: feedbackType,
        screenshot: screenshotBase64
          ? {
              data: screenshotBase64,
              mimeType: screenshot!.type,
              name: screenshot!.name,
            }
          : undefined,
        pluginVersion: plugin.manifest.version,
      };

      const response = await requestUrl({
        url: FEEDBACK_ENDPOINT,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status >= 200 && response.status < 300) {
        new Notice("Feedback submitted — thank you!");
        onClose();
      } else {
        new Notice("Failed to submit feedback. Please try again.");
      }
    } catch {
      new Notice("Failed to submit feedback. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Screenshot button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className={`${accentButtonClass} w-full`}
      >
        <span
          ref={(el) => {
            if (el) setIcon(el, "image");
          }}
          className="inline-flex items-center"
          aria-hidden
        />
        Take screenshot
      </button>

      {/* Screenshot preview */}
      {screenshot && previewUrl && (
        <div className="bg-modifier-form-field border-modifier-border flex items-center gap-2 rounded border p-2">
          <img
            src={previewUrl}
            alt="Screenshot preview"
            className="h-12 w-12 flex-shrink-0 rounded object-cover"
          />
          <span className="text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
            {screenshot.name}
          </span>
          <button
            onClick={removeScreenshot}
            aria-label="Remove screenshot"
            className="text-muted flex-shrink-0 cursor-pointer border-none bg-transparent p-0.5 hover:opacity-70"
          >
            <span
              ref={(el) => {
                if (el) setIcon(el, "x");
              }}
              className="inline-flex items-center"
              aria-hidden
            />
          </button>
        </div>
      )}

      {/* Email */}
      <div className="flex flex-col gap-1">
        <label className="text-normal text-xs font-medium">
          Email <span className="text-error">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          placeholder="your@email.com"
          className={`${fieldClass} ${emailError ? "border-error" : ""}`}
        />
        {emailError && <span className="text-error text-xs">{emailError}</span>}
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-normal text-xs font-medium">
          Title <span className="text-error">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title"
          className={fieldClass}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-normal text-xs font-medium">
          Description <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description"
          rows={4}
          className={`${fieldClass} resize-y`}
        />
      </div>

      {/* Feedback type */}
      <select
        value={feedbackType}
        onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
        className={selectClass}
      >
        {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((type) => (
          <option key={type} value={type}>
            {FEEDBACK_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !isSubmittable}
          className={`${accentButtonClass} px-5 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {isSubmitting ? (
            "Submitting…"
          ) : (
            <>
              Submit
              <span
                ref={(el) => {
                  if (el) setIcon(el, "send");
                }}
                className="inline-flex items-center"
                aria-hidden
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export class FeedbackModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("Discourse Graphs feedback");
    const { contentEl } = this;
    contentEl.empty();
    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <FeedbackContent plugin={this.plugin} onClose={() => this.close()} />
      </StrictMode>,
    );
  }

  onClose(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
