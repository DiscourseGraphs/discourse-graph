// TODO POST MIGRATE - See if we could reuse the Live Preview from workbench instead
import { Button, Tooltip } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderReactElement } from "~/utils/reactRender";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

const sizes = [300, 400, 500, 600];

const TooltipContent = ({
  tag,
  open,
  close,
}: {
  tag: string;
  open: (e: boolean) => void;
  close: () => void;
}) => {
  const uid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const numChildren = useMemo(() => getChildrenLengthByPageUid(uid), [uid]);
  const [isEmpty, setIsEmpty] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizeIndex, setSizeIndex] = useState(0);
  const size = useMemo(() => sizes[sizeIndex % sizes.length], [sizeIndex]);
  useEffect(() => {
    document
      .getElementById("roamjs-discourse-live-preview-container")
      ?.remove?.();
    let newIsEmpty = true;
    if (
      numChildren &&
      containerRef.current &&
      containerRef.current.parentElement
    ) {
      const el = document.createElement("div");
      el.id = "roamjs-discourse-live-preview-container";
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el,
      });
      containerRef.current.appendChild(el);
      containerRef.current.parentElement.style.padding = "0";
      newIsEmpty = false;
    }
    setIsEmpty(newIsEmpty);
  }, [uid, containerRef, numChildren, tag, setIsEmpty]);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={(e) => open(e.ctrlKey)}
      onMouseLeave={close}
    >
      {!isEmpty && (
        <Button
          minimal
          style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
          icon={"zoom-in"}
          onClick={() => setSizeIndex(sizeIndex + 1)}
        />
      )}
      <div
        ref={containerRef}
        className={"roamjs-discourse-live-preview"}
        style={{
          paddingTop: !isEmpty ? 16 : 0,
          maxWidth: size,
          maxHeight: size,
        }}
      >
        {isEmpty && (
          <span>
            Page <i>{tag}</i> is empty.
          </span>
        )}
      </div>
    </div>
  );
};

export type Props = {
  tag: string;
  registerMouseEvents: (a: {
    open: (ctrl: boolean) => void;
    close: () => void;
    span: HTMLSpanElement | null;
  }) => void;
};

const LivePreview = ({ tag, registerMouseEvents }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const spanRef = useRef<HTMLSpanElement>(null);
  const openRef = useRef<boolean>(false);
  const timeoutRef = useRef(0);
  const open = useCallback(
    (ctrlKey: boolean) => {
      if (ctrlKey || timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => {
          setIsOpen(true);
          openRef.current = true;
          timeoutRef.current = 0;
        }, 100);
      }
    },
    [setIsOpen, timeoutRef, openRef],
  );
  const close = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (openRef.current) {
      timeoutRef.current = window.setTimeout(() => {
        setIsOpen(false);
        openRef.current = false;
        timeoutRef.current = 0;
      }, 1000);
    }
  }, [setIsOpen, timeoutRef, openRef]);
  useEffect(() => {
    if (!loaded) setLoaded(true);
  }, [loaded, setLoaded]);
  useEffect(() => {
    if (loaded) {
      registerMouseEvents({ open, close, span: spanRef.current });
    }
  }, [spanRef, loaded, close, open, registerMouseEvents]);
  const ref = useRef<Tooltip>(null);
  useEffect(() => {
    ref.current?.reposition();
  }, [tag]);
  return (
    <Tooltip
      content={<TooltipContent tag={tag} open={open} close={close} />}
      placement={"right"}
      isOpen={isOpen}
      ref={ref}
    >
      <span ref={spanRef} />
    </Tooltip>
  );
};

export const render = ({
  parent,
  ...props
}: {
  parent: HTMLSpanElement;
} & Props) => renderReactElement(<LivePreview {...props} />, parent);

export default LivePreview;
