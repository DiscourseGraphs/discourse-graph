import { App, Events, Plugin, Component } from "obsidian";

// extracted the MetaadataTypeManager from "obsidian-types",
// and parts of internalPlugins, plugins.

type FocusMode = "both" | "end" | "start";

export type PropertyWidgetComponentBase = {
  /**
   * The type of the property widget.
   */
  type: string;
  /**
   * Focus the property widget.
   *
   * @param mode - The focus mode.
   */
  focus(mode?: FocusMode): void;
};

type PropertyRenderContext = {
  /**
   * Reference to the app.
   */
  app: App;
  /**
   * Key of the property field.
   */
  key: string;
  /**
   * Determine the source path of current context.
   */
  sourcePath: string;
  /**
   * Callback called on property field unfocus.
   */
  blur(): void;
  /**
   * Callback called on property value change.
   *
   * @param value - The new property value.
   */
  onChange(value: unknown): void;
};

export type PropertyWidget<
  ComponentType extends
    PropertyWidgetComponentBase = PropertyWidgetComponentBase,
> = {
  /**
   * Lucide-dev icon associated with the widget.
   */
  icon: string;
  /**
   * Reserved keys for the widget.
   */
  reservedKeys?: string[];
  /**
   * Identifier for the widget.
   */
  type: string;
  /**
   * Returns the I18N name of the widget.
   *
   * @returns The localized name of the widget.
   */
  name(): string;
  /**
   * Render function for the widget on field container given context and data.
   *
   * @param containerEl - The container element to render the widget into.
   * @param data - The property data to render.
   * @param context - The rendering context for the property.
   * @returns The rendered widget component.
   */
  render(
    containerEl: HTMLElement,
    data: unknown,
    context: PropertyRenderContext,
  ): ComponentType;
  /**
   * Validate whether the input value to the widget is correct.
   *
   * @param value - The value to validate.
   * @returns Whether the value is valid.
   */
  validate(value: unknown): boolean;
};

type PropertyWidgetType = string;

type MetadataTypeManager = {
  /**
   * Registered type widgets.
   */
  registeredTypeWidgets: Record<PropertyWidgetType, PropertyWidget>;
  /**
   * Get assigned widget type for property.
   *
   * @param property - Property name.
   * @returns The assigned widget type, or `null`.
   */
  getAssignedWidget(property: string): null | PropertyWidgetType;
  /**
   * Set widget type for property.
   *
   * @param property - Property name.
   * @param type - Widget type to assign.
   * @returns A promise that resolves when the widget type is set.
   */
  setType(property: string, type: PropertyWidgetType): Promise<void>;
  /**
   * Unset widget type for property.
   *
   * @param property - Property name.
   * @returns A promise that resolves when the widget type is unset.
   */
  unsetType(property: string): Promise<void>;
} & Events;

export type InternalPluginInstance = {
  plugin: InternalPlugin;
};

type InternalPlugin = {
  enabled: boolean;
  instance: InternalPluginInstance;
} & Component;

export type AppWithUnofficialApis = App & {
  appId: string;
  metadataTypeManager?: MetadataTypeManager;
  plugins?: Events & { plugins?: Record<string, Plugin> };
  internalPlugins?: Events & {
    plugins?: Record<string, InternalPlugin>;
  };
};
