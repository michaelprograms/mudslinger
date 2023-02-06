import { AppInfo } from "./appInfo";

export class DonateWin {
    private $win: JQuery;

    constructor() {
        let win = document.getElementsByClassName("winDonate")[0];
        this.$win = $(win);

        (<any>this.$win).jqxWindow({width: 450, height: 150});
    }

    public show() {
        (<any>this.$win).jqxWindow("open");
        (<any>this.$win).jqxWindow("bringToFront");
    }
}
