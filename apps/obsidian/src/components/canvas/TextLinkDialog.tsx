import { useCallback, useEffect, useRef, useState } from "react";
import {
  T,
  TLBaseShape,
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
import { isAllowedTextLinkUrl } from "~/components/canvas/utils/textShapeLink";

type ShapeWithUrl = TLBaseShape<string, { url: string }>;

// Declared as a function property rather than reusing TLUiDialogProps, whose
// method-shorthand onClose trips @typescript-eslint/unbound-method.
type TextLinkDialogProps = { onClose: () => void };

type UrlValidity = { isValid: boolean; hasProtocol: boolean };

// Only text shapes carry the widened url validator. Geo and friends keep
// tldraw's T.linkUrl, so accepting obsidian:// for them would throw on save.
const validateUrlForShape = (url: string, shapeType: string): UrlValidity => {
  const isAllowed =
    shapeType === "text"
      ? (value: string) => isAllowedTextLinkUrl(value)
      : (value: string) => T.linkUrl.isValid(value);

  if (isAllowed(url)) return { isValid: true, hasProtocol: true };
  if (isAllowed(`https://${url}`)) return { isValid: true, hasProtocol: false };
  return { isValid: false, hasProtocol: false };
};

// A fork of tldraw's EditLinkDialog, which is not exported. Copy differs: the
// original's msg() keys are inlined, as this app has no i18n layer.
export const TextLinkDialog = track(({ onClose }: TextLinkDialogProps) => {
  const editor = useEditor();
  const selectedShape = editor.getOnlySelectedShape();

  if (
    !(
      selectedShape &&
      "url" in selectedShape.props &&
      typeof selectedShape.props.url === "string"
    )
  ) {
    return null;
  }

  return (
    <TextLinkDialogInner
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

    const rInitialValue = useRef(selectedShape.props.url);

    const [urlInputState, setUrlInputState] = useState(() => {
      const result = validateUrlForShape(selectedShape.props.url, shapeType);
      const initialValue = result.isValid
        ? result.hasProtocol
          ? selectedShape.props.url
          : `https://${selectedShape.props.url}`
        : "https://";
      return { actual: initialValue, safe: initialValue, valid: true };
    });

    const handleChange = useCallback(
      (rawValue: string) => {
        // Auto-correct a doubled https:// from a bad paste.
        const fixedRawValue = rawValue.replace(
          /https?:\/\/(https?:\/\/)/,
          (_match, arg1: string) => arg1,
        );
        const result = validateUrlForShape(fixedRawValue, shapeType);
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
          props: { url: "" },
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
      // Selection can change under an open dialog; the value was validated
      // against the type we opened on.
      if (onlySelectedShape.type !== shapeType) return onClose();

      if (
        "url" in onlySelectedShape.props &&
        onlySelectedShape.props.url !== urlInputState.safe
      ) {
        editor.updateShapes([
          {
            id: onlySelectedShape.id,
            type: onlySelectedShape.type,
            props: { url: urlInputState.safe },
          },
        ]);
      }
      onClose();
    }, [editor, onClose, shapeType, urlInputState]);

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
                : shapeType === "text"
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
