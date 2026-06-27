import { EventHook } from "./event";

import { OutputManager } from "./outputManager";
import { OutWinBase } from "./outWinBase";


export class Mxp {
    public EvtEmitCmd = new EventHook<{value: string, noPrint: boolean}>();

    private openTags: Array<string> = [];
    private tagHandlers: Array<(tag: string) => boolean> = [];

    constructor(private outputManager: OutputManager, private chatWin: OutWinBase | undefined, private clientName: string) {
        this.makeTagHandlers();
    }

    private makeTagHandlers() {
        this.tagHandlers.push((tag) => {
            let re = /^<version>$/i;
            let match = re.exec(tag);
            if (match) {
                this.EvtEmitCmd.fire({
                    value: "\x1b[1z<VERSION CLIENT=" + this.clientName + " MXP=0.01>", // using closing line tag makes it print twice...
                    noPrint: true});
                return true;
            }
            return false;
        });

        this.tagHandlers.push((tag) => {
            /* handle image tags */
            let re = /^<image\s*(\S+)\s*url="(.*)">$/i;
            let match = re.exec(tag);
            if (match) {
                const img = document.createElement("img");
                img.src = match[2] + match[1];
                this.outputManager.pushMxpElem(img);
                this.outputManager.popMxpElem();
                return true;
            }

            return false;
        });

        if (this.chatWin) {
            this.tagHandlers.push((tag) => {
                /* handle dest tags */
                let re = /^<dest comm>$/i;
                let match = re.exec(tag);
                if (match) {
                    this.openTags.push("dest");
                    this.outputManager.pushTarget(this.chatWin!);
                    return true;
                }

                re = /^<\/dest>$/i;
                match = re.exec(tag);
                if (match) {
                    if (this.openTags[this.openTags.length - 1] !== "dest") {
                        /* We actually expect this to happen because the mud sends newlines inside DEST tags right now... */
                        // console.log("Got closing dest tag with no opening tag.");
                    } else {
                        this.openTags.pop();
                        this.outputManager.popTarget();
                    }
                    return true;
                }

                return false;
            });
        }

        this.tagHandlers.push((tag) => {
            let re = /^<a /i;
            let match = re.exec(tag);
            if (match) {
                this.openTags.push("a");
                // ponytail: tag is an MXP <a> element from the server; parse href via DOMParser to avoid innerHTML
                const doc = new DOMParser().parseFromString(tag + "</a>", "text/html");
                const parsed = doc.body.firstElementChild as HTMLAnchorElement | null;
                const elem = document.createElement("a");
                if (parsed?.href) elem.href = parsed.href;
                elem.target = "_blank";
                elem.classList.add("underline");

                this.outputManager.pushMxpElem(elem);
                return true;
            }

            re = /^<\/a>/i;
            match = re.exec(tag);
            if (match) {
                if (this.openTags[this.openTags.length - 1] !== "a") {
                    /* We actually expect this to happen because the mud sends newlines inside DEST tags right now... */
                    console.log("Got closing a tag with no opening tag.");
                } else {
                    this.openTags.pop();
                    this.outputManager.popMxpElem();
                }
                return true;
            }

            return false;
        });
        this.tagHandlers.push((tag) => {
            let re = /^<([bius])>/i;
            let match = re.exec(tag);
            if (match) {
                this.openTags.push(match[1]);
                const elem = document.createElement(match[1] as keyof HTMLElementTagNameMap) as HTMLElement;
                this.outputManager.pushMxpElem(elem);
                return true;
            }

            re = /^<\/([bius])>/i;
            match = re.exec(tag);
            if (match) {
                if (this.openTags[this.openTags.length - 1] !== match[1]) {
                    console.log("Got closing " + match[1] + " tag with no opening tag.");
                } else {
                    this.openTags.pop();
                    this.outputManager.popMxpElem();
                }
                return true;
            }

            return false;
        });
        this.tagHandlers.push((tag) => {
            let re = /^<send/i;
            let match = re.exec(tag);
            if (match) {
                /* match with explicit href */
                let tag_re = /^<send (?:href=)?["'](.*)["']>$/i;
                let tag_m = tag_re.exec(tag);
                if (tag_m) {
                    let cmd = tag_m[1];
                    const elem = document.createElement("a");
                    elem.href = "#";
                    elem.title = cmd;
                    elem.classList.add("underline");
                    elem.addEventListener("click", () => {
                        this.EvtEmitCmd.fire({value: cmd, noPrint: false});
                    });
                    this.openTags.push("send");
                    this.outputManager.pushMxpElem(elem);
                    return true;
                }

                /* just the tag */
                tag_re = /^<send>$/i;
                tag_m = tag_re.exec(tag);
                if (tag_m) {
                    this.openTags.push("send");
                    const elem = document.createElement("a");
                    elem.href = "#";
                    elem.classList.add("underline");
                    this.outputManager.pushMxpElem(elem);
                    return true;
                }
            }

            re = /^<\/send>/i;
            match = re.exec(tag);
            if (match) {
                if (this.openTags[this.openTags.length - 1] !== "send") {
                    console.log("Got closing send tag with no opening tag.");
                } else {
                    this.openTags.pop();
                    const elem = this.outputManager.popMxpElem();
                    if (elem && !elem.hasAttribute("title")) {
                        /* didn't have explicit href so we need to do it here */
                        const txt = elem.textContent || "";
                        elem.setAttribute("title", txt);
                        elem.addEventListener("click", () => {
                            this.EvtEmitCmd.fire({value: txt, noPrint: false});
                        });
                    }
                }
                return true;
            }

            return false;
        });
    }

    handleMxpTag(data: string) {
        let handled = false;
        for (let i = 0; i < this.tagHandlers.length; i++) {
            /* tag handlers will return true if it's a match */
            if (this.tagHandlers[i](data)) {
                handled = true;
                break;
            }
        }

        if (!handled) {
            console.log("Unsupported MXP tag: " + data);
        }
    };

    // Need to close any remaining open tags when we get newlines
    public handleNewline() {
        if (this.openTags.length < 1) {
            return;
        }

        for (let i = this.openTags.length - 1; i >= 0; i--) {
            if (this.openTags[i] === "dest") {
                this.outputManager.popTarget();
            } else {
                this.outputManager.popMxpElem();
            }
        }
        this.openTags = [];
    };
}
