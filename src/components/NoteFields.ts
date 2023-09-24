import MetadataMenu from "main";
import { ButtonComponent, Component, Modal, TFile } from "obsidian";
import Field from "src/fields/Field";
import { FileClassAttributeModal } from "src/fileClass/FileClassAttributeModal";
import ChooseSectionModal from "src/modals/chooseSectionModal"
import * as FieldType from "src/types/fieldTypes"
import { FieldManager as FM } from "src/types/fieldTypes";
import { FieldManager as F, FieldManager } from "src/fields/FieldManager";
import { insertMissingFields } from "src/commands/insertMissingFields";
import { FileClass } from "src/fileClass/fileClass";
import { genuineKeys } from "src/utils/dataviewUtils";
import { FileClassManager } from "./fileClassManager";
import { getLineFields } from "src/utils/parser";
import { Note } from "src/note/note";

export class FieldOptions {

    constructor(public container: HTMLDivElement) { }

    public addOption(icon: string, onclick: () => {} | void, tooltip?: string, className?: string) {
        const fieldOptionContainer = this.container.createDiv({ cls: "field-item field-option" })
        const fieldOption = new ButtonComponent(fieldOptionContainer)
        fieldOption.setIcon(icon)
        if (className) fieldOption.buttonEl.addClass(className);
        fieldOption.onClick(() => onclick())
        if (tooltip) fieldOption.setTooltip(tooltip);
    }
}

export class FieldsModal extends Modal {

    private dvApi?: any
    public fields: Field[]
    public fieldContainers: HTMLDivElement[] = [];
    //private maxOptions: number = 0;
    private missingFields: boolean = false;

    constructor(
        public plugin: MetadataMenu,
        private file: TFile
    ) {
        super(plugin.app);
        this.dvApi = plugin.app.plugins.plugins.dataview?.api;
        this.getFields();
        this.containerEl.addClass("metadata-menu")
        this.containerEl.addClass("note-fields-modal")
    }

    //ok
    onOpen() {
        this.titleEl.setText(`Fields of ${this.file.basename}.${this.file.extension}`)
        this.buildFieldsContainer();
    };

    //ok
    getFields(): void {
        this.fields = this.plugin.fieldIndex.filesFields.get(this.file.path) || [];
    }

    //
    buildFieldContainer(container: HTMLDivElement, field: Field, value?: string | null | undefined): void {
        const fieldManager = new FM[field.type](this.plugin, field)
        const fieldNameWrapper = container.createDiv({ cls: "field-name-wrapper" })
        const fieldNameContainer = fieldNameWrapper.createDiv({ text: `${field.name}`, cls: "field-item field-name" });
        const fieldSettingsWrapper = container.createDiv({ cls: "field-settings-wrapper" });
        fieldSettingsWrapper.createDiv({ cls: "field-settings-spacer" })
        const fileClass = field.fileClassName ? this.plugin.fieldIndex.fileClassesName.get(field.fileClassName) : undefined
        if (fileClass) {
            fieldNameContainer.addClass(`fileClassField__${fileClass.name.replace("/", "___").replaceAll(" ", "_")}`)
        }
        const fieldSettingContainer = fieldSettingsWrapper.createDiv({ cls: "field-item field-setting" });
        const fieldSettingBtn = new ButtonComponent(fieldSettingContainer);
        fieldSettingBtn.setIcon("gear")
        fieldSettingBtn.setTooltip(`${field.fileClassName ? field.fileClassName + " > " : "Preset Field > "} ${field.name} settings`)
        fieldSettingBtn.onClick(() => {
            const _fileClass = field.fileClassName ? this.plugin.fieldIndex.fileClassesName.get(field.fileClassName) : undefined
            const fileClassAttribute = _fileClass?.attributes.find(attr => attr.id === field.id)
            if (fileClassAttribute && _fileClass) {
                const fileClassAttributeModal = new FileClassAttributeModal(this.plugin, _fileClass, fileClassAttribute)
                fileClassAttributeModal.open();
            }
        })
        const fieldTypeContainer = fieldSettingsWrapper.createDiv({ cls: `field-item` });
        fieldTypeContainer.createDiv({ text: field.type, cls: `chip field-type ${FieldType.FieldBackgroundColorClass[field.type]}` })
        const fieldValueWrapper = container.createDiv({ cls: "field-value-wrapper" })
        const fieldValueContainer = fieldValueWrapper.createDiv({
            cls: value !== undefined && value !== null ? "field-item field-value" : "field-item field-value emptyfield"
        })
        if (value === null) {
            fieldValueContainer.setText(field.type === FieldType.FieldType.Lookup ? "---auto---" : "<empty>");
        } else if (value === undefined) {
            this.missingFields = true
            fieldValueContainer.setText("<missing>");
        } else {
            fieldManager.displayValue(fieldValueContainer, this.file, field.name, () => { this.close() })
        }
        const fieldOptionsWrapper = container.createDiv({ cls: "field-options-wrapper" });
        fieldOptionsWrapper.createDiv({ cls: "field-options-spacer" });
        const fieldOptions = new FieldOptions(fieldOptionsWrapper)
        if (value !== undefined) {
            fieldManager.addFieldOption(field.name, value, this.file, fieldOptions);
        } else {
            const fieldBtnContainer = fieldOptionsWrapper.createDiv({ cls: "field-item field-option" })
            const fieldBtn = new ButtonComponent(fieldBtnContainer)
            fieldBtn.setIcon("list-plus")
            fieldBtn.setTooltip("Add field at section")
            fieldBtn.onClick(() => {
                new ChooseSectionModal(
                    this.plugin,
                    this.file,
                    (
                        lineNumber: number,
                        after: boolean,
                        asList: boolean,
                        asComment: boolean
                    ) => FieldManager.openFieldModal(
                        this.plugin,
                        this.file,
                        field.name,
                        "",
                        lineNumber,
                        after,
                        asList,
                        asComment
                    )
                ).open();
            })
        };
    }

    openInsertMissingFieldsForFileClassModal(fileClass: FileClass): void {
        const dvApi = this.plugin.app.plugins.plugins.dataview?.api
        if (dvApi) {
            const dvFile = dvApi.page(this.file.path);
            if (dvFile) {
                const modal = new ChooseSectionModal(
                    this.plugin,
                    this.file,
                    (
                        lineNumber: number,
                        after: boolean,
                        asList: boolean,
                        asComment: boolean
                    ) => insertMissingFields(
                        this.plugin,
                        dvFile.file.path,
                        lineNumber,
                        after,
                        asList,
                        asComment,
                        fileClass.name
                    )
                );
                modal.open()
            }
        }
    }

    missingFieldsForFileClass(fileClass: FileClass): boolean {
        const currentFieldsNames: string[] = []

        const dvApi = this.plugin.app.plugins.plugins.dataview?.api
        if (dvApi) {
            const dvFile = dvApi.page(this.file.path);
            if (dvFile) {
                currentFieldsNames.push(...genuineKeys(dvFile))
            }
        };
        const note = new Note(this.plugin, this.file)
        note.buildLines()

        const missingFields = fileClass && this.file ?
            !this.plugin.fieldIndex.fileClassesFields.get(fileClass.name)?.map(f => f.name).every(fieldName => currentFieldsNames.includes(fieldName)) :
            false
        return missingFields
    }

    buildFileClassManager(container: HTMLDivElement): void {
        const fileClasses = this.plugin.fieldIndex.filesFileClasses.get(this.file.path) || [];
        fileClasses.forEach(fileClass => {
            const fileClassManagerContainer = container.createDiv({ cls: "fields-inheritance-manager-container" })
            const _ancestors = this.plugin.fieldIndex.fileClassesAncestors.get(fileClass.name) || [];
            const ancestors = [..._ancestors].reverse();
            ancestors.push(fileClass.name);
            ancestors.forEach((fileClassName, i) => {
                const _fileClass = this.plugin.fieldIndex.fileClassesName.get(fileClassName)
                if (_fileClass) {
                    const fileClassOptionsContainer = fileClassManagerContainer.createDiv({ cls: "fileclass-manager-container" })
                    const fileClassNameContainer = fileClassOptionsContainer.createDiv({ cls: "name", text: _fileClass.name })
                    fileClassNameContainer.setAttr("id", `fileClass__${_fileClass.name.replace("/", "___").replace(" ", "_")}`)

                    if (this.missingFieldsForFileClass(_fileClass)) {
                        const fileClassInsertMissingFieldsBtn = new ButtonComponent(fileClassOptionsContainer)
                        fileClassInsertMissingFieldsBtn.setIcon("battery-full")
                        fileClassInsertMissingFieldsBtn.setTooltip(`Insert missing fields for ${_fileClass.name}`)
                        fileClassInsertMissingFieldsBtn.onClick(() => {
                            this.openInsertMissingFieldsForFileClassModal(_fileClass)
                        })
                    }

                    const fileClassAddAttributeBtn = new ButtonComponent(fileClassOptionsContainer)
                    fileClassAddAttributeBtn.setIcon("plus-circle")
                    fileClassAddAttributeBtn.setTooltip(`Add field definition in ${_fileClass.name}`)
                    fileClassAddAttributeBtn.onClick(() => {
                        const fileClassAttributeModal = new FileClassAttributeModal(this.plugin, _fileClass)
                        fileClassAttributeModal.open()
                    })
                    if (i < ancestors.length - 1) {
                        fileClassManagerContainer.createDiv({ text: ">", cls: "separator" })
                    }

                    const fileClassFieldsContainers = this.containerEl.querySelectorAll(`[class*="fileClassField__${fileClassName.replace("/", "___").replace(" ", "_")}"]`)
                    fileClassFieldsContainers.forEach(fieldNameContainer => {
                        (fieldNameContainer as HTMLDivElement).onmouseover = () => {
                            fileClassNameContainer?.addClass("active")
                        }
                        (fieldNameContainer as HTMLDivElement).onmouseout = () => {
                            fileClassNameContainer?.removeClass("active")
                        }
                    })
                    fileClassNameContainer.onmouseover = () => {
                        this.containerEl
                            .querySelectorAll(`.field-item.field-name.fileClassField__${fileClassName.replace("/", "___").replace(" ", "_")}`)
                            .forEach(cont => { cont.addClass("active") })
                    }
                    fileClassNameContainer.onmouseout = () => {
                        this.containerEl
                            .querySelectorAll(`.field-item.field-name.fileClassField__${fileClassName.replace("/", "___").replace(" ", "_")}`)
                            .forEach(cont => { cont.removeClass("active") })
                    }
                    fileClassNameContainer.onclick = () => {
                        const fileClassComponent = new FileClassManager(this.plugin, _fileClass)
                        this.plugin.addChild(fileClassComponent);
                        this.close();
                    }
                }
            })
        })
    }

    buildFieldsContainer(): void {
        this.missingFields = false
        this.contentEl.replaceChildren();
        this.contentEl.createEl('hr')
        const fieldsContainer = this.contentEl.createDiv({ cls: "note-fields-container" });
        this.fields.forEach(field => {
            const value = this.dvApi ? this.dvApi.page(this.file.path)[field.name] : undefined
            this.buildFieldContainer(fieldsContainer, field, value)
        })
        if (this.missingFields) {
            const insertMissingFieldsContainer = this.contentEl.createDiv({ cls: "insert-all-fields" });
            insertMissingFieldsContainer.createDiv({ text: "Insert missing fields" });
            const insertMissingFieldsBtn = new ButtonComponent(insertMissingFieldsContainer)
            insertMissingFieldsBtn.setIcon("battery-full")
            insertMissingFieldsBtn.onClick(() => {
                const dvFile = this.dvApi?.page(this.file.path)
                if (dvFile) {
                    new ChooseSectionModal(
                        this.plugin,
                        this.file,
                        (
                            lineNumber: number,
                            after: boolean,
                            asList: boolean,
                            asComment: boolean
                        ) => insertMissingFields(
                            this.plugin,
                            dvFile.file.path,
                            lineNumber,
                            after,
                            asList,
                            asComment
                        )
                    ).open();
                }
            })
        }
        this.contentEl.createEl('hr')
        const fileClassManagersContainer = this.contentEl.createDiv({ cls: "fields-container" });
        this.buildFileClassManager(fileClassManagersContainer)
    }
}

export default class NoteFieldsComponent extends Component {

    private fieldsModal: FieldsModal;

    constructor(
        public plugin: MetadataMenu,
        public cacheVersion: string,
        public onChange: () => void,
        public file: TFile
    ) {
        super();
        this.fieldsModal = new FieldsModal(this.plugin, file)
        this.fieldsModal.onClose = () => {
            this.plugin.removeChild(this)
            this.unload()
        }
    }

    onload(): void {
        this.plugin.registerEvent(this.plugin.app.metadataCache.on('dataview:metadata-change', () => {
            this.fieldsModal.getFields();
            this.fieldsModal.buildFieldsContainer();
        }))
        this.fieldsModal.open()
    }
}