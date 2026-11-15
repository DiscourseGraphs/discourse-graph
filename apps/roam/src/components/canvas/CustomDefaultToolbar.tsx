/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable preferArrows/prefer-arrow-functions */

// from tldraw 3.14.2 packages/tldraw/src/lib/ui/components/Toolbar/DefaultToolbar.tsx
import { useEditor, usePassThroughWheelEvents, useValue } from "@tldraw/editor";
import React, { ReactNode, memo, useRef } from "react";
import {
  useBreakpoint,
  useReadonly,
  useTldrawUiComponents,
  PORTRAIT_BREAKPOINT,
  DefaultToolbarContent,
  OverflowingToolbar,
  MobileStylePanel,
  TldrawUiButton,
  TldrawUiButtonIcon,
  TldrawUiToolbar,
  useTranslation,
} from "tldraw";
import classNames from "classnames";
import { useClipboard } from "./Clipboard";

// from tldraw 3.14.2 Toolbar/ToggleToolLockedButton.tsx, which tldraw doesn't export
const ToggleToolLockedButton = ({
  activeToolId,
}: {
  activeToolId?: string;
}) => {
  const editor = useEditor();
  const breakpoint = useBreakpoint();
  const msg = useTranslation();
  const isToolLocked = useValue(
    "is tool locked",
    () => editor.getInstanceState().isToolLocked,
    [editor],
  );
  const tool = useValue("current tool", () => editor.getCurrentTool(), [
    editor,
  ]);

  if (!activeToolId || !tool.isLockable) return null;

  return (
    <TldrawUiButton
      type="normal"
      title={msg("action.toggle-tool-lock")}
      data-testid="tool-lock"
      className={classNames("tlui-toolbar__lock-button", {
        "tlui-toolbar__lock-button__mobile":
          breakpoint < PORTRAIT_BREAKPOINT.TABLET_SM,
      })}
      onClick={() =>
        editor.updateInstanceState({ isToolLocked: !isToolLocked })
      }
    >
      <TldrawUiButtonIcon icon={isToolLocked ? "lock" : "unlock"} small />
    </TldrawUiButton>
  );
};

/** @public */
export interface DefaultToolbarProps {
  children?: ReactNode;
}

/**
 * The default toolbar for the editor. `children` defaults to the `DefaultToolbarContent` component.
 * Depending on the screen size, the children will overflow into a drop-down menu, with the most
 * recently active item from the overflow being shown in the main toolbar.
 *
 * @public
 * @react
 */

export const CustomDefaultToolbar = memo(function DefaultToolbar({
  children,
}: DefaultToolbarProps) {
  const editor = useEditor();
  const breakpoint = useBreakpoint();
  const isReadonlyMode = useReadonly();
  const activeToolId = useValue(
    "current tool id",
    () => editor.getCurrentToolId(),
    [editor],
  );

  const { isOpen: isClipboardOpen, toggleClipboard } = useClipboard();

  const { ActionsMenu, QuickActions } = useTldrawUiComponents();
  const msg = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  usePassThroughWheelEvents(ref);

  const showQuickActions =
    editor.options.actionShortcutsLocation === "menu"
      ? false
      : editor.options.actionShortcutsLocation === "toolbar"
        ? true
        : breakpoint < PORTRAIT_BREAKPOINT.TABLET;

  return (
    <div ref={ref} className="tlui-toolbar">
      <div className="tlui-toolbar__inner">
        <div className="tlui-toolbar__left">
          {!isReadonlyMode && (
            <div className="tlui-toolbar__extras">
              {/* 3.12+ toolbar buttons must sit inside a TldrawUiToolbar */}
              {showQuickActions && (
                <TldrawUiToolbar
                  className="tlui-toolbar__extras__controls tlui-buttons__horizontal"
                  label={msg("actions-menu.title")}
                >
                  {QuickActions && <QuickActions />}
                  {ActionsMenu && <ActionsMenu />}
                </TldrawUiToolbar>
              )}

              {/* Customized Clipboard toggle button */}
              {activeToolId === "discourse-tool" && (
                <TldrawUiButton
                  type="normal"
                  title={"Toggle Clipboard"}
                  data-testid="clipboard-toggle"
                  data-clipboard-open={isClipboardOpen}
                  className={classNames(
                    "tlui-toolbar__lock-button",
                    "clipboard-toggle-button",
                    {
                      "tlui-toolbar__lock-button__mobile":
                        breakpoint < PORTRAIT_BREAKPOINT.TABLET_SM,
                    },
                  )}
                  style={{
                    marginRight: "35px",
                    ...(isClipboardOpen && {}),
                  }}
                  onClick={toggleClipboard}
                >
                  <TldrawUiButtonIcon icon={"clipboard-copy"} small />
                </TldrawUiButton>
              )}
              {/* End of Customized Clipboard toggle button */}

              <ToggleToolLockedButton activeToolId={activeToolId} />
            </div>
          )}
          <OverflowingToolbar>
            {children ?? <DefaultToolbarContent />}
          </OverflowingToolbar>
        </div>
        {breakpoint < PORTRAIT_BREAKPOINT.TABLET_SM && !isReadonlyMode && (
          <div className="tlui-toolbar__tools">
            <MobileStylePanel />
          </div>
        )}
      </div>
    </div>
  );
});
