/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable preferArrows/prefer-arrow-functions */

// from /packages/tldraw/src/lib/ui/components/Toolbar/DefaultToolbar.tsx
import { useEditor, useValue } from "@tldraw/editor";
import React, { ReactNode, memo } from "react";
import {
  useBreakpoint,
  useReadonly,
  useTldrawUiComponents,
  PORTRAIT_BREAKPOINT,
  DefaultToolbarContent,
  /* @ts-ignore */
  ToggleToolLockedButton,
  /* @ts-ignore */
  OverflowingToolbar,
  /* @ts-ignore */
  MobileStylePanel,
  TldrawUiButton,
  TldrawUiButtonIcon,
} from "tldraw";
import classNames from "classnames";
import { useClipboard } from "./Clipboard";

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

  return (
    <div className="tlui-toolbar">
      <div className="tlui-toolbar__inner">
        <div className="tlui-toolbar__left">
          {!isReadonlyMode && (
            <div className="tlui-toolbar__extras">
              {breakpoint < PORTRAIT_BREAKPOINT.TABLET && (
                <div className="tlui-toolbar__extras__controls tlui-buttons__horizontal">
                  {QuickActions && <QuickActions />}
                  {ActionsMenu && <ActionsMenu />}
                </div>
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
