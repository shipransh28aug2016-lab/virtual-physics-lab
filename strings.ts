/**
 * Bilingual UI strings (English + NCERT-style Devanagari Hindi).
 *
 * Only interface chrome lives here. Deep scientific prose (theory paragraphs,
 * viva answers) intentionally falls back to English so that a translation is
 * never lower quality than the source; the switch still affects everything that
 * has a vetted Hindi string below.
 */
export interface Localized {
  en: string;
  hi: string;
}

export const STRINGS = {
  // ------------------------------------------------------------- navigation
  'nav.simulators': { en: 'Simulators', hi: 'सिम्युलेटर' },
  'nav.class12': { en: 'Class XII', hi: 'कक्षा XII' },
  'nav.practicals': { en: 'Practicals', hi: 'प्रयोग' },
  'nav.skip': { en: 'Skip to main content', hi: 'मुख्य सामग्री पर जाएँ' },
  'nav.home': { en: 'home', hi: 'मुखपृष्ठ' },

  // ----------------------------------------------------------------- header
  'header.search': { en: 'Search', hi: 'खोजें' },
  'header.searchExperiments': { en: 'Search experiments', hi: 'प्रयोग खोजें' },
  'header.searchPlaceholder': {
    en: 'Search experiments, chapters or apparatus…',
    hi: 'प्रयोग, अध्याय या उपकरण खोजें…'
  },
  'header.searchEmpty': {
    en: 'No experiment matches',
    hi: 'कोई प्रयोग मेल नहीं खाता'
  },
  'header.toggleIndex': { en: 'Toggle experiment index', hi: 'प्रयोग सूची खोलें/बंद करें' },
  'header.favourites': { en: 'Favourites', hi: 'पसंदीदा' },
  'header.langToggle': { en: 'Language', hi: 'भाषा' },
  'header.curriculum': { en: 'CBSE / NCERT aligned', hi: 'CBSE / NCERT संरेखित' },

  // ----------------------------------------------------------------- footer
  'footer.units': { en: 'Physics units', hi: 'भौतिकी इकाइयाँ' },
  'footer.practicals': { en: 'Practicals', hi: 'प्रयोग' },
  'footer.popular': { en: 'Popular apparatus', hi: 'प्रमुख उपकरण' },
  'footer.about': { en: 'About this lab', hi: 'इस प्रयोगशाला के बारे में' },
  'footer.blurb': {
    en: 'An independent implementation of an interactive physics laboratory for CBSE Class XII. Every apparatus is driven by a numerical model — nothing here is a static diagram.',
    hi: 'CBSE कक्षा XII हेतु एक स्वतंत्र, अंतःक्रियात्मक भौतिकी प्रयोगशाला। प्रत्येक उपकरण एक संख्यात्मक मॉडल द्वारा संचालित है — यहाँ कुछ भी स्थिर चित्र नहीं है।'
  },

  // ------------------------------------------------------- experiment shell
  'shell.breadcrumb.class12': { en: 'Class XII', hi: 'कक्षा XII' },
  'shell.theory': { en: 'Theory', hi: 'सिद्धांत' },
  'shell.formulae': { en: 'Formulae', hi: 'सूत्र' },
  'shell.procedure': { en: 'Procedure', hi: 'प्रक्रिया' },
  'shell.result': { en: 'Result', hi: 'परिणाम' },
  'shell.precautions': { en: 'Precautions', hi: 'सावधानियाँ' },
  'shell.viva': { en: 'Viva', hi: 'मौखिकी' },
  'shell.tips': { en: 'Tips', hi: 'सुझाव' },
  'shell.variables': { en: 'Variables', hi: 'राशियाँ' },
  'shell.sourcesOfError': { en: 'Sources of error', hi: 'त्रुटि के स्रोत' },
  'shell.symbol': { en: 'Symbol', hi: 'संकेत' },
  'shell.quantity': { en: 'Quantity', hi: 'राशि' },
  'shell.siUnit': { en: 'SI unit', hi: 'SI मात्रक' },
  'shell.note': { en: 'Note', hi: 'टिप्पणी' },
  'shell.measurements': { en: 'Measurements', hi: 'मापन' },
  'shell.graph': { en: 'Graph', hi: 'ग्राफ' },
  'shell.favourite': { en: 'Favourite', hi: 'पसंदीदा' },
  'shell.favourited': { en: 'Favourited', hi: 'पसंदीदा ✓' },
  'shell.print': { en: 'Print', hi: 'प्रिंट' },
  'shell.defaults': { en: 'Defaults', hi: 'मूल मान' },
  'shell.record': { en: 'Record reading', hi: 'पाठ्यांक अंकित करें' },
  'shell.observation': { en: 'Observation table', hi: 'प्रेक्षण सारणी' },
  'shell.labNotebook': { en: 'Lab notebook', hi: 'प्रेक्षण पुस्तिका' },
  'shell.clear': { en: 'Clear', hi: 'साफ़ करें' },
  'shell.remove': { en: 'Remove', hi: 'हटाएँ' },
  'shell.resultFromState': {
    en: 'Result from the current apparatus state',
    hi: 'वर्तमान उपकरण स्थिति से परिणाम'
  },
  'shell.checkParams': { en: 'Check the parameters', hi: 'पैरामीटर जाँचें' },
  'shell.outOfRange': { en: 'Working outside the usual range', hi: 'सामान्य सीमा से बाहर' },
  'shell.moreInUnit': { en: 'More experiments in this unit', hi: 'इस इकाई में और प्रयोग' },
  'shell.allUnits': { en: 'All units', hi: 'सभी इकाइयाँ' },
  'shell.previous': { en: 'Previous', hi: 'पिछला' },
  'shell.next': { en: 'Next', hi: 'अगला' },

  // ------------------------------------------------------------- catalogue
  'cat.viewAll': { en: 'View all', hi: 'सभी देखें' },
  'cat.experiments': { en: 'experiments', hi: 'प्रयोग' },
  'cat.startHere': { en: 'Start here', hi: 'यहाँ से आरंभ करें' },
  'cat.searchLabel': { en: 'Search', hi: 'खोज' },

  // -------------------------------------------------------------- difficulty
  'diff.easy': { en: 'Easy', hi: 'सरल' },
  'diff.moderate': { en: 'Moderate', hi: 'मध्यम' },
  'diff.advanced': { en: 'Advanced', hi: 'उन्नत' },

  // ------------------------------------------------------------------ kind
  'kind.practical': { en: 'Listed practical', hi: 'सूचीबद्ध प्रयोग' },
  'kind.activity': { en: 'Activity', hi: 'क्रियाकलाप' },
  'kind.theory': { en: 'Theory simulator', hi: 'सिद्धांत सिम्युलेटर' },

  // ------------------------------------------------------------------- rail
  'rail.browse': { en: 'Browse', hi: 'ब्राउज़' },
  'rail.allSimulators': { en: 'All simulators', hi: 'सभी सिम्युलेटर' },
  'rail.class12units': { en: 'Class XII units', hi: 'कक्षा XII इकाइयाँ' },
  'rail.units': { en: 'Units', hi: 'इकाइयाँ' },

  // ----------------------------------------------------------------- filter
  'filter.theory': { en: 'Theory', hi: 'सिद्धांत' },
  'filter.practical': { en: 'Practical', hi: 'प्रयोग' },
  'filter.favourites': { en: 'Favourites', hi: 'पसंदीदा' },
  'filter.shown': { en: 'shown', hi: 'दर्शित' },
  'filter.placeholder': {
    en: 'Search by experiment, chapter or apparatus',
    hi: 'प्रयोग, अध्याय या उपकरण से खोजें'
  },
  'filter.empty': { en: 'No experiment matches these filters', hi: 'इन फ़िल्टरों से कोई प्रयोग मेल नहीं खाता' },
  'filter.clear': { en: 'Clear filters', hi: 'फ़िल्टर साफ़ करें' },

  // ------------------------------------------------------------------- home
  'home.h1a': { en: 'A working', hi: 'एक कार्यशील' },
  'home.h1em': { en: 'physics laboratory', hi: 'भौतिकी प्रयोगशाला' },
  'home.h1b': { en: 'that runs in your browser', hi: 'जो आपके ब्राउज़र में चलती है' },
  'home.lede': {
    en: 'interactive experiments for CBSE Class XII. Every apparatus is driven by a numerical model — move a control and the physics recomputes, the instrument responds and the reading updates. Record trials, plot graphs and compare against theory in the built-in lab notebook.',
    hi: 'CBSE कक्षा XII हेतु अंतःक्रियात्मक प्रयोग। प्रत्येक उपकरण एक संख्यात्मक मॉडल द्वारा संचालित है — नियंत्रण बदलते ही भौतिकी पुनः परिकलित होती है, यंत्र प्रतिक्रिया करता है और पाठ्यांक अद्यतन होता है। अंतर्निहित प्रेक्षण पुस्तिका में पाठ्यांक अंकित करें, ग्राफ बनाएँ और सिद्धांत से तुलना करें।'
  },
  'home.openIndex': { en: 'Open the simulator index', hi: 'सिम्युलेटर सूची खोलें' },
  'home.practicals': { en: 'CBSE practicals', hi: 'CBSE प्रयोग' },
  'home.simulations': { en: 'Simulations', hi: 'सिमुलेशन' },
  'home.unitsCovered': { en: 'Units covered', hi: 'इकाइयाँ' },
  'home.listedPracticals': { en: 'Listed practicals', hi: 'सूचीबद्ध प्रयोग' },
  'home.engineTests': { en: 'Engine tests', hi: 'इंजन परीक्षण' },
  'home.startHere': { en: 'Start here', hi: 'यहाँ से आरंभ करें' },
  'home.startH2': { en: 'Six experiments that show what this lab can do', hi: 'छह प्रयोग जो इस प्रयोगशाला की क्षमता दर्शाते हैं' },
  'home.startLede': {
    en: 'Each one opens with the apparatus already running. Change a parameter and watch the model, the instrument needle and the graph move together.',
    hi: 'प्रत्येक प्रयोग चलते हुए उपकरण के साथ खुलता है। पैरामीटर बदलें और मॉडल, यंत्र की सुई तथा ग्राफ को साथ-साथ बदलते देखें।'
  },
  'home.viewAll': { en: 'View all', hi: 'सभी देखें' },
  'home.syllabus': { en: 'Syllabus', hi: 'पाठ्यक्रम' },
  'home.orgByUnit': { en: 'Organised by NCERT unit', hi: 'NCERT इकाई अनुसार क्रमबद्ध' }
} satisfies Record<string, Localized>;

export type StrKey = keyof typeof STRINGS;
