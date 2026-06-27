import * as Util from "../core/util";
import { colorIdToHtml } from "../protocol/color";
import { EventHook } from "../core/event";

export interface ConfigIf {
    onSet(key: "colorsEnabled", cb: (val: any) => void): void;
    getDef(key: "colorsEnabled", def: any): any;
}

export class OutWinBase {
    public EvtLine = new EventHook<string>();

    private colorsEnabled: boolean;

    private lineCount: number = 0;
    private maxLines: number = 5000;

    constructor(protected rootElem: HTMLElement, private config: ConfigIf) {
        this.targetElems = [rootElem];
        this.target = rootElem;

        const span = document.createElement("span");
        rootElem.appendChild(span);
        this.pushElem(span);

        this.rootElem.addEventListener("scroll", (e: Event) => { this.handleScroll(e); });

        this.colorsEnabled = this.config.getDef("colorsEnabled", true);
        this.config.onSet("colorsEnabled", (val: any) => { this.setColorsEnabled(val); });
    }


    public setMaxLines(count: number) {
        this.maxLines = count;
    }

    private setColorsEnabled(val: boolean) {
        if (val === this.colorsEnabled) {
            return;
        }

        this.colorsEnabled = val;

        for (let colorId in colorIdToHtml) {
            let colorHtml = colorIdToHtml[colorId];

            this.rootElem.querySelectorAll<HTMLElement>(".fg-" + colorId).forEach(el => el.style.color = this.colorsEnabled ? colorHtml : "");
            this.rootElem.querySelectorAll<HTMLElement>(".bg-" + colorId).forEach(el => el.style.backgroundColor = this.colorsEnabled ? colorHtml : "");
            this.rootElem.querySelectorAll<HTMLElement>(".bb-" + colorId).forEach(el => el.style.borderBottomColor = this.colorsEnabled ? colorHtml : "");
        }
    }

    private fgColorId: string | null = null;
    private bgColorId: string | null = null;

    public setFgColorId(colorId: string | null) {
        this.fgColorId = colorId;
    }

    public setBgColorId(colorId: string | null) {
        this.bgColorId = colorId;
    };

    // handling nested elements, always output to last one
    private targetElems: HTMLElement[];
    private underlineNest = 0;
    protected target: HTMLElement;

    private scrollLock = false; // true when we should not scroll to bottom
    private handleScroll(_e: Event) {
        const scrollHeight = this.rootElem.scrollHeight;
        const scrollTop = this.rootElem.scrollTop;
        const outerHeight = this.rootElem.offsetHeight;
        const is_at_bottom = outerHeight + scrollTop >= scrollHeight;

        this.scrollLock = !is_at_bottom;
    }

    // elem is an HTMLElement
    public pushElem(elem: HTMLElement) {
        this.writeBuffer();

        this.target.appendChild(elem);
        this.targetElems.push(elem);
        this.target = elem;

        if (elem.classList.contains("underline")) {
            this.underlineNest += 1;
        }
    }

    public popElem() {
        this.writeBuffer();

        let popped = this.targetElems.pop();
        this.target = this.targetElems[this.targetElems.length - 1];

        if (popped && popped.classList.contains("underline")) {
            this.underlineNest -= 1;
        }

        return popped;
    }

    private appendBuffer = "";
    private lineText = ""; // track full text of the line with no escape sequences or tags
    public addText(txt: string) {
        this.lineText += txt;
        let html = Util.rawToHtml(txt);
        let spanText = "<span";

        let classText = "";
        if (this.fgColorId) {
            classText += "fg-" + this.fgColorId + " ";
        }
        if (this.bgColorId) {
            classText += "bg-" + this.bgColorId + " ";
        }
        if (this.underlineNest > 0) {
            classText += "bb-" + (this.fgColorId || "") + " ";
        }

        if (classText !== "") {
            spanText += " class=\"" + classText + "\"";
        }

        let styleText = "";

        if (this.underlineNest > 0) {
            styleText += "border-bottom-style:solid;";
            styleText += "border-bottom-width:1px;";
            if (this.colorsEnabled && this.fgColorId) {
                styleText += "border-bottom-color:" + colorIdToHtml[this.fgColorId] + ";";
            }
        }

        if (this.colorsEnabled) {

            if (this.fgColorId) {
                styleText += "color:" + colorIdToHtml[this.fgColorId] + ";";
            }
            if (this.bgColorId) {
                styleText += "background-color:" + colorIdToHtml[this.bgColorId] + ";";
            }
        }

        if (styleText !== "") {
            spanText += " style=\"" + styleText + "\"";
        }

        spanText += ">";
        spanText += html;
        spanText += "</span>";
        this.appendBuffer += spanText;

        if (txt.endsWith("\n")) {
            // ponytail: safe — server text goes through rawToHtml(); span attrs come from fixed color lookup
            this.target.insertAdjacentHTML("beforeend", this.appendBuffer);
            this.appendBuffer = "";
            this.newLine();
        }
    };

    private newLine() {
        this.popElem(); // pop the old line
        const span = document.createElement("span");
        this.target.appendChild(span);
        this.pushElem(span);

        this.EvtLine.fire(this.lineText);
        this.lineText = "";

        this.lineCount += 1;
        if (this.lineCount > this.maxLines) {
            const toRemove = Array.from(this.rootElem.children).slice(0, this.maxLines / 2);
            toRemove.forEach(c => c.remove());
            this.lineCount = (this.maxLines / 2);
        }
    }

    private writeBuffer() {
        // ponytail: safe — same as addText, all dynamic content is rawToHtml()-escaped
        this.target.insertAdjacentHTML("beforeend", this.appendBuffer);
        this.appendBuffer = "";
    };

    public outputDone() {
        this.writeBuffer();
        this.scrollBottom();
    };

    private scrollRequested = false;
    private privScrolBottom() {
        this.rootElem.scrollTop = this.rootElem.scrollHeight;
        this.scrollLock = false;
        this.scrollRequested = false;
    };

    protected scrollBottom(force: boolean = false) {
        if (this.scrollLock && force !== true) {
            return;
        }
        if (this.scrollRequested) {
            return;
        }

        requestAnimationFrame(() => this.privScrolBottom());
        this.scrollRequested = true;
    }
}
