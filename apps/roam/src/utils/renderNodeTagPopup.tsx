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
  currentPopup.className = "absolute z-[9999] max-w-none font-inherit bg-white";
  currentPopup.style.left = `${rect.left + window.scrollX}px`;
  currentPopup.style.top = `${rect.top + window.scrollY - 35}px`;

  document.body.appendChild(currentPopup);

  currentPopup.addEventListener("mouseleave", removeNodeTagPopup, {
    once: true,
  });

  ReactDOM.render(
    <Button intent="primary" outlined onClick={onClick} text={label} />,
    currentPopup,
  );
};
