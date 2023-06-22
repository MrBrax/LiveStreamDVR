import i18next from "i18next";
import i18nextMiddleware from "i18next-http-middleware";
import messages_de from "../Translations/de.json";
import messages_en from "../Translations/en.json";

/*
i18next.init({
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
});
*/

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

i18next.on("languageChanged", (lng) => {
    console.log("Language changed to " + lng);
});

i18next.on("initialized", (options) => {
    console.log(`Initialized with ${options}`);
});

i18next.on("loaded", (loaded) => {
    console.log("Loaded " + loaded);
});

i18next.on("failedLoading", (lng, ns, msg) => {
    console.log(`Failed loading ${lng} ${ns} ${msg}`);
});

i18next.on("missingKey", (lngs, namespace, key, res) => {
    console.log(`Missing key ${key}`);
});

export default i18nextMiddleware.handle(i18next, {});