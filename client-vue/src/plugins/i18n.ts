import { createI18n } from "vue-i18n";
import messages_en from "../translations/en.json";
import messages_sv from "../translations/sv.json";
import messages_ko from "../translations/ko.json";
import messages_de from "../translations/de.json";

export default createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: {
        en: messages_en,
        sv: messages_sv,
        ko: messages_ko,
        de: messages_de
    },
});