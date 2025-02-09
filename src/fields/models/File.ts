import MetadataMenu from "main"
import { FuzzyMatch, TFile, setIcon } from "obsidian"
import { ActionLocation, IField, IFieldManager, Target, isSingleTargeted } from "src/fields/Field"
import { IFieldBase } from "src/fields/base/BaseField"
import { ISettingsModal } from "src/fields/base/BaseSetting"
import * as AbstractFile from "src/fields/models/abstractModels/AbstractFile"
import { buildMarkDownLink } from "src/fields/models/abstractModels/AbstractFile"
import { Constructor } from "src/typings/types"
import { getLink } from "src/utils/parser"

export class Base extends AbstractFile.Base implements IFieldBase {
    type = <const>"File"
    tooltip = "Accepts an internal link"
}

export interface Options extends AbstractFile.Options { }
export interface DefaultedOptions extends AbstractFile.DefaultedOptions { }
export const DefaultOptions: AbstractFile.DefaultedOptions = AbstractFile.DefaultOptions

export function settingsModal(Base: Constructor<ISettingsModal<AbstractFile.DefaultedOptions>>): Constructor<ISettingsModal<Options>> {
    const base = AbstractFile.settingsModal(Base)
    return class SettingsModal extends base { }
}

export function valueModal(managedField: IFieldManager<Target, Options>, plugin: MetadataMenu): Constructor<AbstractFile.Modal<Target>> {
    const base = AbstractFile.valueModal(managedField, plugin)
    return class ValueModal extends base {
        private selectedFilePath?: string
        constructor(...rest: any[]) {
            super()
            if (isSingleTargeted(this.managedField)) this.selectedFilePath = getLink(this.managedField.value, this.managedField.target)?.path
        }

        async onChooseItem(item: TFile): Promise<void> {
            this.saved = true
            let alias: string | undefined = undefined;
            const dvApi = plugin.app.plugins.plugins.dataview?.api
            if (dvApi && this.managedField.options.customRendering) {
                alias = new Function("page", `return ${this.managedField.options.customRendering}`)(dvApi.page(item.path))
            }
            const newValue = buildMarkDownLink(plugin, item, item.path, undefined, alias)
            if (newValue === this.managedField.value) {
                this.managedField.save("")
            } else {
                this.managedField.save(buildMarkDownLink(plugin, item, item.path, undefined, alias))
            }
            this.close()
        }

        renderSuggestion(value: FuzzyMatch<TFile>, el: HTMLElement) {
            const dvApi = plugin.app.plugins.plugins.dataview?.api
            if (dvApi && this.managedField.options.customRendering) {
                const suggestionContainer = el.createDiv({ cls: "item-with-add-on" });
                suggestionContainer.createDiv({
                    text: new Function("page", `return ${this.managedField.options.customRendering}`)(dvApi.page(value.item.path))
                })
                const filePath = suggestionContainer.createDiv({ cls: "add-on" })
                filePath.setText(value.item.path)
            } else {
                el.setText(value.item.basename)
            }
            el.addClass("value-container")
            const spacer = this.containerEl.createDiv({ cls: "spacer" })
            el.appendChild(spacer)
            if (this.selectedFilePath === value.item.path) {
                el.addClass("value-checked")
                const iconContainer = el.createDiv({ cls: "icon-container" })
                setIcon(iconContainer, "check-circle")
            }
            this.inputEl.focus()
        }

        async onAdd(): Promise<void> {
            const vault = this.managedField.plugin.app.vault;
            const newFileName = this.inputEl.value;
            const targetDirectory = this.managedField.options.customFileDirectory ?? "";
            const filePath = `${targetDirectory}/${newFileName}.md`;
            
            try {
                // Create new file
                const newFile = await vault.create(filePath, "");

                // apply template
                const templateFilePath = managedField.options.templateFilePath;
                if (this.app.plugins.enabledPlugins.has("templater-obsidian") && templateFilePath) {
                    const insertText = await this.applyTemplate(templateFilePath, filePath);    
                    // modify the new file
                    await vault.modify(newFile, insertText);
                }
                
                // Add the new file to selected files
                if (newFile instanceof TFile) {
                    this.onChooseItem(newFile);
                }
            } catch (error) {
                console.error("Failed to create new file:", error);
            }
        }

        async applyTemplate(templateFilePath: string, targetFilePath: string): Promise<any> {
            const templaterPlugin: any = this.app.plugins.getPlugin("templater-obsidian");
            if (templaterPlugin) {
                const templaterAPI = templaterPlugin.templater;
                
                const templateFile = this.app.vault.getAbstractFileByPath(templateFilePath);
                if (!templateFile || !(templateFile instanceof TFile)) {
                    console.log(`Template file not found: ${templateFilePath}`);
                    throw new Error(`Template file not found: ${templateFilePath}`);
                }

                const targetFile = this.app.vault.getAbstractFileByPath(targetFilePath);
                if (!targetFile || !(targetFile instanceof TFile)) {
                    console.log(`Target file not found: ${targetFilePath}`);
                    throw new Error(`Target file not found: ${targetFilePath}`);
                }
                
                enum Templater_RunMode {
                    CreateNewFromTemplate,
                    AppendActiveFile,
                    OverwriteFile,
                    OverwriteActiveFile,
                    DynamicProcessor,
                    StartupTemplate,
                }

                const runningConfig = templaterAPI.create_running_config(
                    templateFile,
                    targetFile,
                    Templater_RunMode.DynamicProcessor,
                );
                
                return await templaterAPI.read_and_parse_template(runningConfig);
                
            }
        }
    }
}

export function createDvField(
    managedField: IFieldManager<Target, Options>,
    dv: any,
    p: any,
    fieldContainer: HTMLElement,
    attrs: { cls?: string, attr?: Record<string, string>, options?: Record<string, string> } = {}
): void {
    return AbstractFile.createDvField(managedField, dv, p, fieldContainer, attrs)
}

export function valueString(managedField: IFieldManager<Target, Options>): string {
    return AbstractFile.valueString(managedField)
}

export function displayValue(managedField: IFieldManager<Target, Options>, container: HTMLDivElement, onClicked: () => any) {
    return AbstractFile.displayValue(managedField, container, onClicked)
}

export function actions(plugin: MetadataMenu, field: IField<Options>, file: TFile, location: ActionLocation, indexedPath: string | undefined): void {
    return AbstractFile.actions(plugin, field, file, location, indexedPath)
}

export function getOptionsStr(field: IField<Options>): string {
    return AbstractFile.getOptionsStr(field)
}

export function validateValue(managedField: IFieldManager<Target, Options>): boolean {
    if (Array.isArray(managedField.value) && managedField.value.length == 1) {
        return AbstractFile.getFiles(managedField).map(f => f.path).includes(managedField.value[0].path)
    } else if (typeof managedField.value === "string") {
        return AbstractFile.getFiles(managedField).map(f => f.path).includes(managedField.value)
    } else if (managedField.value.hasOwnProperty('path')) {
        return AbstractFile.getFiles(managedField).map(f => f.path).includes(managedField.value.path)
    } else {
        return false
    }
}

