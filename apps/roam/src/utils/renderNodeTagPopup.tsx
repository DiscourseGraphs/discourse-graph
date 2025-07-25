import React from "react";
import ReactDOM from "react-dom";
import { Button } from "@blueprintjs/core";

let currentPopup: HTMLDivElement | null = null;

export const removeNodeTagPopup = () => {
  if (currentPopup) {
    ReactDOM.unmountComponentAtNode(currentPopup);
    currentPopup.remove();
    currentPopup = null;
  }
};

export const renderNodeTagPopup = ({
  tagElement,
  onClick,
  label = "Create node",
}: {
  tagElement: HTMLElement;
  onClick: () => void;
  label?: string;
}) => {
  removeNodeTagPopup();

  const rect = tagElement.getBoundingClientRect();

  currentPopup = document.createElement("div");
  currentPopup.id = "discourse-node-tag-popup";
  currentPopup.style.position = "absolute";
  currentPopup.style.left = `${rect.left + window.scrollX}px`;
  currentPopup.style.top = `${rect.bottom + window.scrollY + 4}px`;
  currentPopup.className = "z-[9999] max-w-none font-inherit bg-white";

  document.body.appendChild(currentPopup);

  // Remove when pointer leaves the popup
  currentPopup.addEventListener("mouseleave", removeNodeTagPopup, {
    once: true,
  });

  ReactDOM.render(
    <Button intent="primary" minimal onClick={onClick} text={label} />,
    currentPopup,
  );
};
