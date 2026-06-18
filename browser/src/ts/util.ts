export function replaceLtGt(text: string): string {
    return text.replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
}

export function replaceAmp(text: string): string {
    return text.replace(/&/g, "&amp;");
}

export function replaceLf(text: string): string {
    // We are presumably already stripping out CRs before this
    return text.replace(/\n/g, "<br>");
}

export function rawToHtml(text: string): string {
    return replaceLf(
            replaceLtGt(
            replaceAmp(text)));
}

/* https://stackoverflow.com/questions/13356493/decode-utf-8-with-javascript */
export function utf8decode(array: Uint8Array): { result: string; partial: Uint8Array } {
    let out, i, len, c;
    let char2, char3, char4;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
        c = array[i++];
    
        switch(c >> 4)
        { 
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                if ( (i + 1) > len) {
                    return { result: out, partial: array.slice(i - 1) };
                }
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                if ( (i + 2) > len) {
                    return { result: out, partial: array.slice(i - 1) };
                }
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                               ((char2 & 0x3F) << 6) |
                               ((char3 & 0x3F) << 0));
                break;
            case 15:
                // 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
                if ( (i + 3) > len) {
                    return { result: out, partial: array.slice(i - 1) };
                }
                char2 = array[i++];
                char3 = array[i++];
                char4 = array[i++];
                out += String.fromCodePoint(((c & 0x07) << 18) | ((char2 & 0x3F) << 12) | ((char3 & 0x3F) << 6) | (char4 & 0x3F));

                break;
        }
    }

    return { result: out, partial: null };
}
