import { App, Events, Debouncer, Plugin, Component } from "obsidian";

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

export type PropertyWidgetEntry = {
  /**
   * Display name of the property widget.
   */
  name: string;
  /**
   * The property widget type.
   */
  widget: string;
};

type PropertyInfo = {
  /**
   * Name of property.
   */
  name: string;
  /**
   * Usage count of property.
   */
  occurrences: number;
  /**
   * Type of property.
   */
  widget: string;
};

type TypeInfo = {
  /**
   * The explicitly assigned property widget type.
   */
  expected: PropertyWidget;
  /**
   * The property widget type inferred from the value.
   */
  inferred: PropertyWidget;
};

type PropertyWidgetType = string;

export type MetadataTypeManager = {
  /**
   * Reference to the {@link obsidian#App}.
   */
  app: App;
  /**
   * Associated widget types for each property.
   */
  assignedWidgets: Record<string, PropertyWidgetEntry>;
  /**
   * Unix timestamp of the last save
   */
  lastSave: number;
  /**
   * Debounced handler for property type config file changes on disk.
   */
  onConfigFileChange: Debouncer<[], Promise<void>>;
  /**
   * Registered properties of the vault.
   */
  properties: Record<string, PropertyInfo>;
  /**
   * Registered type widgets.
   */
  registeredTypeWidgets: Record<PropertyWidgetType, PropertyWidget>;
  /**
   * Get all registered properties of the vault.
   *
   * @returns Record of property names to their info.
   */
  getAllProperties(): Record<string, PropertyInfo>;
  /**
   * Get assigned widget type for property.
   *
   * @param property - Property name.
   * @returns The assigned widget type, or `null`.
   */
  getAssignedWidget(property: string): null | PropertyWidgetType;
  /**
   * Get info for property.
   *
   * @param property - Property name.
   * @returns Information about the property.
   */
  getPropertyInfo(property: string): PropertyInfo;
  /**
   * Get expected widget type for property and the one inferred from the property value.
   *
   * @param property - Property name.
   * @param value - Property value.
   * @returns Type information for the property.
   */
  getTypeInfo(property: string, value: unknown): TypeInfo;
  /**
   * Get property widget.
   *
   * @param type - Widget type name.
   * @returns The property widget.
   */
  getWidget(type: string): PropertyWidget;
  /**
   * Load metadata type configuration.
   */
  load(): Promise<void>;
  /**
   * Load property types from config.
   *
   * @returns A promise that resolves when the property types are loaded.
   */
  loadData(): Promise<void>;
  /**
   * Handle raw file system change events for the property type config.
   *
   * @param e - The raw file system change event.
   */
  onRaw(e: unknown): void;
  /**
   * Register event listeners for property type config file changes.
   */
  registerListeners(): void;
  /**
   * Save property types to config.
   *
   * @returns A promise that resolves when the property types are saved.
   */
  save(): Promise<void>;
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
  /**
   * Updates `this.properties` to match the {@link obsidian#MetadataCache}
   */
  updatePropertyInfoCache(): void;
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
