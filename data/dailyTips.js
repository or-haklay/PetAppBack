const DAILY_TIPS = [
  {
    he: "כלבים מקררים את עצמם בעיקר בהתנשפות ומזיעים דרך כריות הכפות.",
    en: "Dogs cool themselves mostly by panting and sweat through their paw pads.",
    category: "dog",
  },
  {
    he: "טביעת האף של כלב ייחודית כמו טביעת אצבע אנושית.",
    en: "A dog's nose print is unique, like a human fingerprint.",
    category: "dog",
  },
  {
    he: "החלפת מסלולי טיול שומרת על עניין ומעשירה את חוש הריח.",
    en: "Changing walking routes keeps things interesting and enriches scent exploration.",
    category: "dog",
  },
  {
    he: "לעולם אל תתנו עצמות מבושלות לכלב – הן עלולות להתפצל ולפגוע.",
    en: "Never give cooked bones to dogs—they can splinter and cause injury.",
    category: "dog",
  },
  {
    he: "רתמה מתאימה מאפשרת להכניס שני אצבעות בנוחות בין הרצועה לגוף.",
    en: "A proper harness fit allows two fingers comfortably between strap and body.",
    category: "dog",
  },
  {
    he: "חשיפה הדרגתית לעולם בונה ביטחון ומפחיתה פחדים אצל כלבים צעירים.",
    en: "Gradual, positive exposure builds confidence and reduces fears in young dogs.",
    category: "dog",
  },
  {
    he: "צעצועי לעיסה בטוחים מסייעים להפחתת סטרס ולשימור שיניים נקיות.",
    en: "Safe chew toys help reduce stress and support cleaner teeth.",
    category: "dog",
  },
  {
    he: "אימונים קצרים ומהנים יעילים יותר מסשנים ארוכים ומתישים.",
    en: "Short, fun training sessions are more effective than long, tiring ones.",
    category: "dog",
  },
  {
    he: "שבב אלקטרוני ותג זיהוי חיצוני מגבירים סיכוי לחזרה מהירה הביתה.",
    en: "A microchip and external ID tag increase the chance of a quick return home.",
    category: "dog",
  },
  {
    he: "לעולם אל תשאירו כלב ברכב סגור—אפילו לא דקות ספורות—חום מצטבר מסוכן.",
    en: "Never leave a dog in a closed car—even for minutes—heat builds dangerously.",
    category: "dog",
  },
  {
    he: "בדקו אספלט עם גב כף היד; אם חם לכם, חם מדי לכפות הכלב.",
    en: "Test asphalt with the back of your hand; if it's hot for you, it's too hot for paws.",
    category: "dog",
  },
  {
    he: "כלוב אימון צריך להיות ״מאורה״ בטוחה שנבנית בהדרגה ובחיוביות.",
    en: "A crate should be a safe 'den' introduced gradually and positively.",
    category: "dog",
  },
  {
    he: "חלקו חטיפים קטנים והתאימו את מנה היומית כדי למנוע עלייה במשקל.",
    en: "Use tiny treats and adjust daily meals to prevent weight gain.",
    category: "dog",
  },
  {
    he: "קיצוץ ציפורניים סדיר מונע שינויי יציבה וכאב בכפות.",
    en: "Regular nail trims prevent posture changes and paw discomfort.",
    category: "dog",
  },
  {
    he: "קסיליטול מסוכן לכלבים; הימנעו ממסטיקים וממתקים ללא סוכר.",
    en: "Xylitol is toxic to dogs; avoid sugar-free gums and candies.",
    category: "dog",
  },
  {
    he: "ענבים וצימוקים עלולים להזיק לכלבים—אל תתנו כלל.",
    en: "Grapes and raisins can harm dogs—don't offer them at all.",
    category: "dog",
  },
  {
    he: "ניקוי אוזניים מבצעים רק בתמיסה מאושרת ובהנחיית וטרינר.",
    en: "Clean ears only with vet-approved solution and guidance.",
    category: "dog",
  },
  {
    he: "צחצוח שיניים בהדרגה, עם טעם אהוב, מונע הצטברות אבן.",
    en: "Gradual toothbrushing with a favored flavor helps prevent tartar buildup.",
    category: "dog",
  },
  {
    he: "קחו מים לטיולים ארוכים ושמרו על הפסקות קבועות.",
    en: "Bring water on long walks and schedule regular breaks.",
    category: "dog",
  },
  {
    he: "טיולי ״סניף-פארי״ המאפשרים הרחה חופשית מעייפים מנטלית ומרגיעים.",
    en: "'Sniffari' walks with free sniffing provide mental fatigue and calm.",
    category: "dog",
  },
  {
    he: "צפו בשפת גוף בפארק; לא כל כלב נהנה ממפגשים צפופים.",
    en: "Watch body language at dog parks; not every dog enjoys crowded play.",
    category: "dog",
  },
  {
    he: "שימוש בחיזוק חיובי בונה אמון ושותפות לאורך זמן.",
    en: "Positive reinforcement builds trust and long-term partnership.",
    category: "dog",
  },
  {
    he: "מדדו מזון בכוס מדידה לקבלת מנות עקביות ומעקב משקל.",
    en: "Measure food with a measuring cup for consistent portions and weight control.",
    category: "dog",
  },
  {
    he: "לימוד ״בוא״ אמין מתחיל בבית ומתקדם בהדרגה לשטח פתוח.",
    en: "A reliable recall starts at home and gradually moves to open spaces.",
    category: "dog",
  },
  {
    he: "רצועה רפויה נבנית בעזרת עצירות חכמות ותגמול על קשר עין.",
    en: "Loose-leash walking grows with smart stops and rewarding eye contact.",
    category: "dog",
  },

  {
    he: "לחתולים בדרך כלל יש 18 אצבעות: חמש מקדימה וארבע מאחור.",
    en: "Cats typically have 18 toes: five in front and four on the back paws.",
    category: "cat",
  },
  {
    he: "מרחב אנכי—מדפים ועצים—מפחית מתחים ומגדיל תחושת שליטה.",
    en: "Vertical space—shelves and trees—reduces stress and boosts control.",
    category: "cat",
  },
  {
    he: "כלל זהב בארגזים: אחד לכל חתול ועוד אחד נוסף בבית.",
    en: "Litter box rule: one per cat, plus one extra at home.",
    category: "cat",
  },
  {
    he: "שושנים וליליות עלולות להיות רעילות לחתולים; העדיפו צמחים בטוחים.",
    en: "Lilies can be toxic to cats; choose pet-safe plants.",
    category: "cat",
  },
  {
    he: "חתולים מסתירים כאב; שינויים קלים בהרגלים שווים בדיקה.",
    en: "Cats hide pain; subtle habit changes warrant a checkup.",
    category: "cat",
  },
  {
    he: "מגרדי שריטה יציבים—אופקי ואנכי—שומרים על רהיטים ועל ציפורניים.",
    en: "Stable scratchers—horizontal and vertical—protect furniture and nails.",
    category: "cat",
  },
  {
    he: "משחק מחזורי ״לרדוף–לזנק–לתפוס״ משחרר אנרגיה בצורה בריאה.",
    en: "Hunt-style play—stalk, chase, pounce—releases energy in a healthy way.",
    category: "cat",
  },
  {
    he: "מאכילי פאזל מאטים אכילה ומספקים העשרה יומיומית.",
    en: "Puzzle feeders slow eating and provide daily enrichment.",
    category: "cat",
  },
  {
    he: "רשתות חלון איכותיות מונעות נפילות בסקרנות רגעית.",
    en: "Secure window screens prevent falls during curious moments.",
    category: "cat",
  },
  {
    he: "גם חתול ביתי צריך מעקב וטרינרי וחיסונים לפי המלצה.",
    en: "Indoor cats still need vet checkups and vaccinations as advised.",
    category: "cat",
  },
  {
    he: "מזרקות מים מעודדות שתייה ושומרות על בריאות דרכי השתן.",
    en: "Water fountains encourage drinking and support urinary health.",
    category: "cat",
  },
  {
    he: "שמנים אתריים מסוימים אינם בטוחים לחתולים—הימנעו מפיזור לידם.",
    en: "Some essential oils aren't safe for cats—avoid diffusing around them.",
    category: "cat",
  },
  {
    he: "הברשה קבועה מפחיתה כדורי פרווה ולכלוך על הרהיטים.",
    en: "Regular brushing reduces hairballs and furniture mess.",
    category: "cat",
  },
  {
    he: "״מצמוץ איטי״ הוא מחווה מרגיעה; נסו להשיב באותו קצב.",
    en: "A slow blink is calming; try returning one at the same pace.",
    category: "cat",
  },
  {
    he: "אימון לתיבת נשיאה בהדרגה מקל על נסיעות וביקורי וטרינר.",
    en: "Gradual carrier training eases travel and vet visits.",
    category: "cat",
  },
  {
    he: "הסתירו כבלים ודקו צעצועים בסכנת בליעה; השגיחו על חוטים.",
    en: "Hide cords and watch string toys; they can be swallowed.",
    category: "cat",
  },
  {
    he: "גם חתול הבית כדאי לשבב—בריחה יכולה לקרות לכל אחד.",
    en: "Microchip indoor cats too—escapes can happen to anyone.",
    category: "cat",
  },
  {
    he: "בחרו מקומות חמים בטוחים; הימנעו ממגע ישיר בגופי חימום.",
    en: "Choose safe warm spots; avoid direct contact with heaters.",
    category: "cat",
  },
  {
    he: "אל תשאירו צעצועי חוט ללא השגחה—בליעה מסוכנת.",
    en: "Don't leave string toys unsupervised—ingestion is dangerous.",
    category: "cat",
  },
  {
    he: "שעות האכלה קבועות יוצרות יציבות ומפחיתות בקשות בלילה.",
    en: "Scheduled meals create stability and reduce nighttime begging.",
    category: "cat",
  },
  {
    he: "לעולם אל תשתמשו בתרופות פרעושים לכלבים על חתולים.",
    en: "Never use dog flea medications on cats.",
    category: "cat",
  },
  {
    he: "הסוואת כדור בתוך חטיף רך לעיתים מקלה מתן תרופה בהנחיית וטרינר.",
    en: "Hiding a pill in a soft treat can help—under vet guidance.",
    category: "cat",
  },
  {
    he: "עיקור וסירוס מפחיתים דימום, בריחות והתנהגויות מסוימות.",
    en: "Spaying/neutering reduces roaming, heat cycles, and some behaviors.",
    category: "cat",
  },
  {
    he: "בדקו צמחי בית מראש; רבים אינם מתאימים לחתולים.",
    en: "Check houseplants first; many are unsafe for cats.",
    category: "cat",
  },
  {
    he: "לקשישים עדיפיים ארגזים נמוכים לכניסה קלה ונוחה.",
    en: "Senior cats prefer low-entry litter boxes for easy access.",
    category: "cat",
  },

  {
    he: "תוכיים זקוקים לזמן מחוץ לכלוב ולמגע יומי עם המשפחה.",
    en: "Parrots need out-of-cage time and daily interaction with the family.",
    category: "bird",
  },
  {
    he: "דיאטת זרעים בלבד אינה מספיקה; העדיפו כופתיות וירקות טריים.",
    en: "Seed-only diets are inadequate; choose pellets and fresh vegetables.",
    category: "bird",
  },
  {
    he: "אבוקדו, שוקולד וקפאין מסוכנים לתוכים—הימנעו לחלוטין.",
    en: "Avocado, chocolate, and caffeine are dangerous to parrots—avoid completely.",
    category: "bird",
  },
  {
    he: "צעצועי פוראג'ינג מלמדים חיפוש מזון ומפחיתים שעמום.",
    en: "Foraging toys teach food seeking and reduce boredom.",
    category: "bird",
  },
  {
    he: "רחצה או התזה עדינה משפרות מצב נוצות ועור.",
    en: "Bathing or gentle misting improves feather and skin condition.",
    category: "bird",
  },
  {
    he: "רוב התוכים זקוקים ל־10–12 שעות חושך ושקט לשינה טובה.",
    en: "Most parrots need 10–12 hours of darkness and quiet for quality sleep.",
    category: "bird",
  },
  {
    he: "מוטות בעוביים שונים מונעים לחץ נקודתי על כפות הרגליים.",
    en: "Perches of varied diameters prevent pressure points on feet.",
    category: "bird",
  },
  {
    he: "הימנעו ממוטות נייר זכוכית לאורך זמן—הן שוחקות ומהלכות.",
    en: "Avoid long-term sandpaper perches—they can chafe and injure.",
    category: "bird",
  },
  {
    he: "אדי טפלון/‏PTFE מחומם מסוכנים לציפורים; אווררו מטבחים היטב.",
    en: "Overheated Teflon/PTFE fumes are deadly to birds; ventilate kitchens well.",
    category: "bird",
  },
  {
    he: "אימוני ״סטפ-אפ״ בחיזוק חיובי משפרים טיפול יומיומי.",
    en: "Positive step-up training makes daily handling easier.",
    category: "bird",
  },
  {
    he: "חשיפה לשמש בטוחה מסייעת; זכוכית חוסמת UVB בדרך כלל.",
    en: "Safe sun exposure helps; glass usually blocks UVB.",
    category: "bird",
  },
  {
    he: "בדיקות תקופתיות אצל וטרינר של ציפורים שומרות על בריאות.",
    en: "Regular avian vet checkups help maintain health.",
    category: "bird",
  },
  {
    he: "החליפו צעצועים מדי שבוע כדי למנוע שעמום והרגל.",
    en: "Rotate toys weekly to prevent boredom and habituation.",
    category: "bird",
  },
  {
    he: "עץ לא מטופל ופלדת אל־חלד מתאימים לצעצועים וכלים.",
    en: "Untreated wood and stainless steel are suitable for toys and bowls.",
    category: "bird",
  },
  {
    he: "הימנעו מעשן סיגריות ורוחות פרצים—מערכות נשימה רגישות.",
    en: "Avoid cigarette smoke and drafts—avian respiratory systems are sensitive.",
    category: "bird",
  },
  {
    he: "תנו זמן שקט לצד מוזיקה או דיבור; איזון חשוב לתוכים.",
    en: "Provide quiet time alongside music or talking; balance is important.",
    category: "bird",
  },
  {
    he: "העבירו תוכי במנשא בטוח; קבעו חגירה למניעת החלקה.",
    en: "Transport parrots in a secure carrier; anchor it to prevent sliding.",
    category: "bird",
  },
  {
    he: "בידוד תוכי חדש לפני חיבור לאחרים מפחית סיכוני הדבקה.",
    en: "Quarantine a new parrot before mixing to reduce disease risks.",
    category: "bird",
  },
  {
    he: "אימון מטרה (target) מפחית נשיכות ומכוון התנהגות בעדינות.",
    en: "Target training reduces biting and gently guides behavior.",
    category: "bird",
  },
  {
    he: "עיניים מתכווצות ומהבקה בזנב עשויים לסמן התרגשות או אזהרה.",
    en: "Pinned eyes and tail flares can signal excitement or warning.",
    category: "bird",
  },
  {
    he: "שבירת צעצועים טבעית לתוכים; ספקו חומרי גריסה בטוחים.",
    en: "Shredding toys is natural; provide safe materials to destroy.",
    category: "bird",
  },
  {
    he: "כלוב מרווח מאפשר פרישה מלאה של כנפיים ותנועה חופשית.",
    en: "A roomy cage allows full wing extension and free movement.",
    category: "bird",
  },
  {
    he: "קבעו שגרה יומית צפויה; שינויי פתאום עלולים להלחיץ.",
    en: "Set a predictable daily routine; sudden changes can stress birds.",
    category: "bird",
  },
  {
    he: "צלחות מים ואוכל מפלדת אל־חלד קלות לניקוי ולחיטוי.",
    en: "Stainless-steel dishes are easy to clean and sanitize.",
    category: "bird",
  },
  {
    he: "למדו להכיר סימני עייפות וסיימו אימון בזמן חיובי.",
    en: "Learn fatigue signs and end training on a positive note.",
    category: "bird",
  },

  {
    he: "בדיקות וטרינר קבועות ושינויים עדינים בשגרה משפרים רווחה.",
    en: "Regular vet checks and gentle routine tweaks improve welfare.",
    category: "general",
  },
  {
    he: "שבב מעודכן ותג זיהוי חיצוני חיוניים לכל חיית מחמד.",
    en: "An updated microchip and external ID tag are essential for any pet.",
    category: "general",
  },
  {
    he: "החזיקו ערכת חירום: מים, מזון, תרופות, מסמכים ומוביל.",
    en: "Keep an emergency kit: water, food, meds, documents, and a carrier.",
    category: "general",
  },
  {
    he: "הכירו חיות חדשות בהדרגה עם החלפת ריחות ומפגשים קצרים.",
    en: "Introduce new pets gradually with scent swapping and short meetings.",
    category: "general",
  },
  {
    he: "נקו קערות מדי יום וספקו מים טריים תמיד.",
    en: "Clean bowls daily and always provide fresh water.",
    category: "general",
  },
  {
    he: "השגיחו על ילדים סביב חיות מחמד ולמדו אותם שפת גוף בסיסית.",
    en: "Supervise children around pets and teach basic body language.",
    category: "general",
  },
  {
    he: "לנסיעות ארוכות היערכו מראש: תכנון עצירות, מסמכים ומוביל מתאים.",
    en: "For long trips, plan stops, documents, and a suitable carrier in advance.",
    category: "general",
  },
  {
    he: "אבטחו כבלים וחומרים רעילים; בית בטוח מונע תאונות.",
    en: "Secure cords and toxins; a pet-proofed home prevents accidents.",
    category: "general",
  },
  {
    he: "חיזוק חיובי עובד עם רוב בעלי החיים ועוזר לבנות אמון.",
    en: "Positive reinforcement works with most animals and builds trust.",
    category: "general",
  },
  {
    he: "העשרה יומית מונעת בעיות התנהגות ומשפרת רווחה כללית.",
    en: "Daily enrichment prevents behavior issues and improves overall welfare.",
    category: "general",
  },
  {
    he: "התאימו פעילות לעונות: זהירות מקור קיצוני ומחום גבוה.",
    en: "Adapt activities to seasons: beware of extreme cold and heat.",
    category: "general",
  },
  {
    he: "פגישות טיפוח קצרות ומהנות יוצרות שיתוף פעולה לאורך זמן.",
    en: "Short, pleasant grooming sessions build long-term cooperation.",
    category: "general",
  },
  {
    he: "כבדו אותות ״די״; טיפול בהסכמה מפחית סטרס ופחד.",
    en: "Respect 'no' signals; consent-based handling reduces stress and fear.",
    category: "general",
  },
  {
    he: "תכננו מראש לאסונות: תיק יציאה מוכן לכל בני הבית.",
    en: "Plan ahead for disasters: a go-bag ready for every household member.",
    category: "general",
  },
  {
    he: "אל תתנו תרופות אנושיות ללא הנחיית וטרינר מפורשת.",
    en: "Never give human medications without explicit veterinary guidance.",
    category: "general",
  },
  {
    he: "שוקולד, אלכוהול וקסיליטול מסוכנים לרוב חיות המחמד—הרחק מהישג יד.",
    en: "Chocolate, alcohol, and xylitol are dangerous to most pets—keep away.",
    category: "general",
  },
  {
    he: "שינויים בתזונה או בסביבה מבצעים בהדרגה כדי למנוע סטרס.",
    en: "Make diet or environment changes gradually to avoid stress.",
    category: "general",
  },
  {
    he: "שקלו שקילה חודשית; מעקב מוקדם מגלה בעיות בזמן.",
    en: "Consider monthly weigh-ins; early tracking catches issues in time.",
    category: "general",
  },
  {
    he: "ביטוח בריאות לחיות מחמד עשוי לסייע בניהול הוצאות בלתי צפויות.",
    en: "Pet insurance can help with unexpected veterinary costs.",
    category: "general",
  },
  {
    he: "אימוץ מציל חיים; אם קונים—חקרו אחריות מגדל ותנאי רווחה.",
    en: "Adoption saves lives; if buying, research breeder responsibility and welfare.",
    category: "general",
  },
  {
    he: "שמרו ניקיון בארגז חול ובכלוב; היגיינה מונעת מחלות.",
    en: "Keep litter boxes and enclosures clean; hygiene prevents disease.",
    category: "general",
  },
  {
    he: "העדיפו חומרי ניקוי עדינים ובצעו אוורור, במיוחד ליד ציפורים.",
    en: "Use gentle cleaners and ventilate, especially around birds.",
    category: "general",
  },
  {
    he: "ספקו אזור מנוחה שקט לכל חיה, ללא הפרעות.",
    en: "Provide a quiet rest area for every pet, free of disturbances.",
    category: "general",
  },
  {
    he: "עדכנו פרטי תג ושבב בכל מעבר דירה או שינוי טלפון.",
    en: "Update tag and microchip details after moving or changing numbers.",
    category: "general",
  },
  {
    he: "נהלו יומן אימונים קצר; נתונים עקביים משפרים תוצאות.",
    en: "Keep a brief training log; consistent data improves results.",
    category: "general",
  },
];

module.exports = { DAILY_TIPS };
