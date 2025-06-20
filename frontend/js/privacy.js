// script.js (Te laden op index.html en andere contentpagina's)

document.addEventListener('DOMContentLoaded', () => {
    // Functie om de geldigheid van de toestemming te controleren
    // Toestemming is geldig voor 365 dagen (1 jaar)
    const isConsentValid = () => {
        const consentData = localStorage.getItem('privacyConsent');
        if (!consentData) {
            return false;
        }
        try {
            const { timestamp, accepted } = JSON.parse(consentData);
            const now = new Date().getTime();
            const oneYear = 365 * 24 * 60 * 60 * 1000; // 1 jaar in milliseconden

            if (accepted && (now - timestamp < oneYear)) {
                return true;
            }
        } catch (e) {
            console.error("Fout bij parsen privacyConsent uit localStorage:", e);
            localStorage.removeItem('privacyConsent'); // Verwijder ongeldige data
        }
        return false;
    };

    // Controleer of de gebruiker al toestemming heeft gegeven
    // Als er geen geldige toestemming is en de huidige pagina is NIET privacy.html,
    // dan leiden we de gebruiker om naar privacy.html.
    if (!isConsentValid() && window.location.pathname.indexOf('privacy.html') === -1) {
        // Omleiding naar de privacy pagina
        window.location.href = '../html/privacy.html';
    }
    // Als de gebruiker al toestemming heeft gegeven, of als de huidige pagina privacy.html is,
    // dan doet dit script verder niets op deze pagina.
});