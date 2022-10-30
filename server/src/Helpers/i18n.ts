import i18next from "i18next";
import i18nextMiddleware from "i18next-http-middleware";
import messages_de from "../Translations/de.json";
import messages_en from "../Translations/en.json";

i18next.use(i18nextMiddleware.LanguageDetector).init({
    preload: ["en", "de"],
    fallbackLng: "en",
    resources: {
        en: {
            translation: messages_en,
        },
        de: {
            translation: messages_de,
        },
    },
    detection: {
        lookupHeader: "x-language",
    },
    //...otherOptions,
});

export default i18nextMiddleware.handle(i18next, {});