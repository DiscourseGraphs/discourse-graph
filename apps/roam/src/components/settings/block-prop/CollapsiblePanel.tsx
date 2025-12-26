import React, { useState, ReactNode, useCallback } from "react";
import { Button, Collapse } from "@blueprintjs/core";
import { getGlobalSetting, setGlobalSetting } from "~/utils/Settings/accessors";
import z from "zod";

type Props = {
  header: ReactNode;
  children: ReactNode;
  settingKey?: string[];
  defaultOpen?: boolean;
  className?: string;
};

export const CollapsiblePanel = ({
  header,
  children,
  settingKey,
  defaultOpen = false,
  className = "",
}: Props) => {
  const getPersistedValue = useCallback(() => {
    if (!settingKey || settingKey.length === 0) return undefined;
    const current = getGlobalSetting(settingKey);
    const parsed = z.boolean().safeParse(current);
    return parsed.success ? parsed.data : undefined;
  }, [settingKey]);

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const persisted = getPersistedValue();
    return persisted !== undefined ? persisted : defaultOpen;
  });

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (settingKey && settingKey.length > 0) {
      setGlobalSetting(settingKey, newState);
    }
  };

  return (
    <div
      className={`collapsible-panel rounded-md p-3 hover:bg-gray-50 ${className}`}
      style={{
        border: "1px solid rgba(51, 51, 51, 0.2)",
      }}
    >
      <div
        className="mb-2 flex cursor-pointer items-center justify-between"
        onClick={handleToggle}
      >
        <div className="flex w-full items-center gap-2">
          <Button
            icon={isOpen ? "chevron-down" : "chevron-right"}
            minimal
            small
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
          />
          <div className="flex-grow select-none">{header}</div>
        </div>
      </div>

      <Collapse isOpen={isOpen}>
        <div className="mt-2">{children}</div>
      </Collapse>
    </div>
  );
};
