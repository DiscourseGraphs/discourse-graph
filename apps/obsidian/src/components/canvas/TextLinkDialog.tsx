import { useCallback, useEffect, useRef, useState } from "react";
import {
  TLBaseShape,
  TLShape,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  TldrawUiInput,
  track,
  useEditor,
} from "tldraw";
import {
  getTextShapeLinkUrl,
  isAllowedTextLinkUrl,
  isObsidianUrl,
} from "~/components/canvas/utils/textShapeLink";

type ShapeWithUrl = TLBaseShape<string, { url: string }>;

// Text shapes keep their link in `meta` so the stock props schema is untouched;
// every other shape type uses tldraw's own `props.url`.
const isTextShape = (shape: TLShape): boolean => shape.type === "text";

const linkPatch = (shape: TLShape, url: string) =>
  isTextShape(shape) ? { meta: { url } } : { props: { url } };

const readLinkUrl = (shape: TLShape): string =>
  isTextShape(shape)
    ? getTextShapeLinkUrl(shape)
    : (((shape.props as { url?: unknown }).url as string | undefined) ?? "");

// Declared as a function property rather than reusing TLUiDialogProps, whose
// method-shorthand onClose trips @typescript-eslint/unbound-method.
type TextLinkDialogProps = { onClose: () => void };

type UrlValidity = { isValid: boolean; hasProtocol: boolean };

// Bookmarks link their title with a raw <a href>, not HyperlinkButton, so a
// page link there would reach the OS handler and skip the vault check.
const acceptsPageLinks = (shapeType: string): boolean =>
  shapeType !== "bookmark";

// Every shape type uses tldraw's linkUrl, patched to accept obsidian://open links.
const validateUrl = (url: string, shapeType: string): UrlValidity => {
  // Checked before the https:// fallback, which would accept `https://obsidian://…`.
  if (!acceptsPageLinks(shapeType) && isObsidianUrl(url))
    return { isValid: false, hasProtocol: false };
  if (isAllowedTextLinkUrl(url)) return { isValid: true, hasProtocol: true };
  if (isAllowedTextLinkUrl(`https://${url}`))
    return { isValid: true, hasProtocol: false };
  return { isValid: false, hasProtocol: false };
};

// A fork of tldraw's EditLinkDialog, which is not exported. Copy differs: the
// original's msg() keys are inlined, as this app has no i18n layer.
export const TextLinkDialog = track(({ onClose }: TextLinkDialogProps) => {
  const editor = useEditor();
  const selectedShape = editor.getOnlySelectedShape();

  const canEditLink =
    selectedShape &&
    (isTextShape(selectedShape) ||
      ("url" in selectedShape.props &&
        typeof selectedShape.props.url === "string"));

  if (!canEditLink) return null;

  return (
    <TextLinkDialogInner
      key={selectedShape.id}
      onClose={onClose}
      selectedShape={selectedShape as ShapeWithUrl}
    />
  );
});

const TextLinkDialogInner = track(
  ({
    onClose,
    selectedShape,
  }: TextLinkDialogProps & { selectedShape: ShapeWithUrl }) => {
    const editor = useEditor();
    const rInput = useRef<HTMLInputElement | null>(null);
    const shapeType = selectedShape.type;

    useEffect(() => {
      editor.timers.requestAnimationFrame(() => rInput.current?.focus());
    }, [editor]);

    const rInitialValue = useRef(readLinkUrl(selectedShape));

    const [urlInputState, setUrlInputState] = useState(() => {
      const initialUrl = readLinkUrl(selectedShape);
      const result = validateUrl(initialUrl, shapeType);
      const initialValue = result.isValid
        ? result.hasProtocol
          ? initialUrl
          : `https://${initialUrl}`
        : "https://";
      return { actual: initialValue, safe: initialValue, valid: true };
    });

    const handleChange = useCallback(
      (rawValue: string) => {
        // Drop the prefilled https:// when a full URL is pasted after it.
        const fixedRawValue = rawValue.replace(
          /https?:\/\/((?:https?|obsidian):\/\/)/i,
          (_match, arg1: string) => arg1,
        );
        const result = validateUrl(fixedRawValue, shapeType);
        const safeValue = result.isValid
          ? result.hasProtocol
            ? fixedRawValue
            : `https://${fixedRawValue}`
          : "https://";

        setUrlInputState({
          actual: fixedRawValue,
          safe: safeValue,
          valid: result.isValid,
        });
      },
      [shapeType],
    );

    const handleClear = useCallback(() => {
      const onlySelectedShape = editor.getOnlySelectedShape();
      if (!onlySelectedShape) return;
      editor.updateShapes([
        {
          id: onlySelectedShape.id,
          type: onlySelectedShape.type,
          ...linkPatch(onlySelectedShape, ""),
        },
      ]);
      onClose();
    }, [editor, onClose]);

    const handleComplete = useCallback(() => {
      // Enter reaches this even while Save is disabled, and the fallback
      // "https://" fails both validators.
      if (!urlInputState.valid) return;
      const onlySelectedShape = editor.getOnlySelectedShape();
      if (!onlySelectedShape) return;
      if (readLinkUrl(onlySelectedShape) !== urlInputState.safe) {
        editor.updateShapes([
          {
            id: onlySelectedShape.id,
            type: onlySelectedShape.type,
            ...linkPatch(onlySelectedShape, urlInputState.safe),
          },
        ]);
      }
      onClose();
    }, [editor, onClose, urlInputState]);

    const handleCancel = useCallback(() => {
      onClose();
    }, [onClose]);

    const isRemoving = rInitialValue.current && !urlInputState.valid;

    return (
      <>
        <TldrawUiDialogHeader>
          <TldrawUiDialogTitle>Edit link</TldrawUiDialogTitle>
          <TldrawUiDialogCloseButton />
        </TldrawUiDialogHeader>
        <TldrawUiDialogBody>
          <div className="tlui-edit-link-dialog">
            <TldrawUiInput
              ref={rInput}
              className="tlui-edit-link-dialog__input"
              label="edit-link-dialog.url"
              autoFocus
              autoSelect
              placeholder="https://example.com"
              value={urlInputState.actual}
              onValueChange={handleChange}
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
            <div>
              {!urlInputState.valid
                ? "Invalid URL"
                : acceptsPageLinks(shapeType)
                  ? "Enter a URL, or an obsidian:// link to a page."
                  : "Enter a URL."}
            </div>
          </div>
        </TldrawUiDialogBody>
        <TldrawUiDialogFooter className="tlui-dialog__footer__actions">
          <TldrawUiButton
            type="normal"
            onClick={handleCancel}
            onTouchEnd={handleCancel}
          >
            <TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
          </TldrawUiButton>
          {isRemoving ? (
            <TldrawUiButton
              type="danger"
              onClick={handleClear}
              onTouchEnd={handleClear}
            >
              <TldrawUiButtonLabel>Clear</TldrawUiButtonLabel>
            </TldrawUiButton>
          ) : (
            <TldrawUiButton
              type="primary"
              disabled={!urlInputState.valid}
              onClick={handleComplete}
              onTouchEnd={handleComplete}
            >
              <TldrawUiButtonLabel>Save</TldrawUiButtonLabel>
            </TldrawUiButton>
          )}
        </TldrawUiDialogFooter>
      </>
    );
  },
);
