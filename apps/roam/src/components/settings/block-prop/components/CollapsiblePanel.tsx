import React, { useState, ReactNode, useCallback } from "react";
import { Button, Collapse, Icon } from "@blueprintjs/core";
import {
  getGlobalSetting,
  getPersonalSetting,
  setGlobalSetting,
  setPersonalSetting,
} from "~/components/settings/block-prop/utils/accessors";
import { getPersonalSettingsKey } from "~/components/settings/block-prop/utils/init";
import z from "zod";

type Props = {
  header: ReactNode;
  children: ReactNode;
  settingKey?: string[];
  defaultOpen?: boolean;
  className?: string;
  variant?: "panel" | "sidebar";
};

const getAccessors = (settingKey: string[]) => {
  const [root, ...rest] = settingKey;

  if (root === getPersonalSettingsKey()) {
    return {
      get: () => getPersonalSetting(rest),
      set: (value: boolean) => setPersonalSetting(rest, value),
    };
  }

  return {
    get: () => getGlobalSetting(settingKey),
    set: (value: boolean) => setGlobalSetting(settingKey, value),
  };
};

export const CollapsiblePanel = ({
  header,
  children,
  settingKey,
  defaultOpen = false,
  className = "",
  variant = "panel",
}: Props) => {
  const getPersistedValue = useCallback(() => {
    if (!settingKey || settingKey.length === 0) return undefined;
    const { get } = getAccessors(settingKey);
    const current = get();
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
      const { set } = getAccessors(settingKey);
      set(newState);
    }
  };

  if (variant === "sidebar") {
    return (
      <div className={`collapsible-panel ${className}`}>
        <div
          className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent pl-6 pr-2.5 font-semibold outline-none"
          onClick={handleToggle}
        >
          <div className="flex w-full items-center justify-between">
            {header}
            <span className="sidebar-title-button-chevron p-1">
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          </div>
        </div>
        <Collapse isOpen={isOpen}>{children}</Collapse>
      </div>
    );
  }

  return (
    <div
      className={`collapsible-panel rounded-md border border-[rgba(51,51,51,0.2)] p-3 hover:bg-gray-50 ${className}`}
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
