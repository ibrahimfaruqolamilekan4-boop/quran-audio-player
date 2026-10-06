export interface AzkarItem {
  id: string;
  category: 'morning' | 'evening' | 'after-prayer' | 'sleep' | 'tasbih';
  arabic: string;
  transliteration: string;
  translation: string;
  repeat: number;
  virtue?: string;
  reference?: string;
  audioUrl?: string;
}

export interface AzkarCategory {
  id: 'morning' | 'evening' | 'after-prayer' | 'sleep' | 'tasbih';
  name: string;
  nameArabic: string;
  description: string;
  iconName: string;
  timeHint: string;
}

export const AZKAR_CATEGORIES: AzkarCategory[] = [
  {
    id: 'morning',
    name: 'Morning Azkar',
    nameArabic: 'أذكار الصباح',
    description: 'Recited after Fajr prayer until sunrise for protection and blessing throughout the day',
    iconName: 'Sun',
    timeHint: 'After Fajr until sunrise',
  },
  {
    id: 'evening',
    name: 'Evening Azkar',
    nameArabic: 'أذكار المساء',
    description: 'Recited after Asr or Maghrib prayer until nightfall for peace and divine shelter',
    iconName: 'Sunset',
    timeHint: 'After Asr until Maghrib / Isha',
  },
  {
    id: 'after-prayer',
    name: 'After Salah',
    nameArabic: 'أذكار بعد الصلاة',
    description: 'Recommended supplications and remembrances immediately following the fard prayer',
    iconName: 'Clock',
    timeHint: 'After every obligatory prayer',
  },
  {
    id: 'sleep',
    name: 'Before Sleeping',
    nameArabic: 'أذكار النوم',
    description: 'Peaceful remembrances and protective verses to recite before resting for the night',
    iconName: 'Moon',
    timeHint: 'Before going to sleep',
  },
  {
    id: 'tasbih',
    name: 'Daily Tasbih & Istighfar',
    nameArabic: 'تسابيح واستغفار',
    description: 'Continuous praises, glorification, and seeking forgiveness for any moment of the day',
    iconName: 'Sparkles',
    timeHint: 'Anytime throughout the day',
  },
];

export const AZKAR_ITEMS: AzkarItem[] = [
  // ==========================================
  // MORNING AZKAR (أذكار الصباح)
  // ==========================================
  {
    id: 'm1',
    category: 'morning',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ.',
    transliteration: "Asbahna wa asbahal-mulku lillah, wal-hamdu lillah, la ilaha illallahu wahdahu la shareeka lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadeer. Rabbi as'aluka khayra ma fee hadhal-yawmi wa khayra ma ba'dahu, wa a'oodhu bika min sharri ma fee hadhal-yawmi wa sharri ma ba'dahu.",
    translation: 'We have entered the morning and the kingdom belongs to Allah, and all praise is for Allah. None has the right to be worshipped except Allah alone, without partner. To Him belongs all sovereignty and praise, and He has power over all things. My Lord, I ask You for the good of this day and what comes after it, and I seek refuge in You from the evil of this day and what comes after it.',
    repeat: 1,
    reference: 'Sahih Muslim (2723)',
    virtue: 'Affirms absolute trust, sovereignty, and gratitude to Allah at the break of dawn.',
  },
  {
    id: 'm2',
    category: 'morning',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ.',
    transliteration: "Allahumma Anta Rabbi la ilaha illa Anta, khalaqtanee wa ana 'abduk, wa ana 'ala 'ahdika wa wa'dika mastata't, a'oodhu bika min sharri ma sana't, aboo'u laka bini'matika 'alayya, wa aboo'u bidhanbee faghfir lee fa'innahu la yaghfirudh-dhunooba illa Ant.",
    translation: 'O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your slave, and I abide by Your covenant and promise as best I can. I seek refuge in You from the evil I have committed. I acknowledge Your blessings upon me, and I confess my sins to You; so forgive me, for none forgives sins except You.',
    repeat: 1,
    reference: 'Sayyid al-Istighfar (Chief of Prayers for Forgiveness) - Sahih al-Bukhari (6306)',
    virtue: 'Whoever recites this in the morning with firm conviction and dies that day will enter Paradise.',
  },
  {
    id: 'm3',
    category: 'morning',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.',
    transliteration: "Bismillahil-ladhee la yadurru ma'as-mihi shay'un fil-ardi wa la fis-samaa'i wa Huwas-Samee'ul-'Aleem.",
    translation: 'In the name of Allah, with whose Name nothing on earth or in the heavens can cause harm, and He is the All-Hearing, the All-Knowing.',
    repeat: 3,
    reference: 'Sunan Abi Dawud (5088), Jami at-Tirmidhi (3388)',
    virtue: 'Whoever recites this 3 times in the morning will not be harmed by anything until the evening.',
  },
  {
    id: 'm4',
    category: 'morning',
    arabic: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالإِسْلاَمِ دِينًا، وَبِمُحَمَّدٍ صلى الله عليه وسلم نَبِيًّا.',
    transliteration: "Radeetu billahi Rabbaa, wa bil-Islami deenaa, wa bi-Muhammadin sallallahu 'alayhi wa sallam nabiyyaa.",
    translation: 'I am pleased with Allah as my Lord, with Islam as my religion, and with Muhammad (peace and blessings be upon him) as my Prophet.',
    repeat: 3,
    reference: 'Sunan Abi Dawud (5072), Musnad Ahmad',
    virtue: 'Whoever says this 3 times in the morning and evening, Allah has promised to grant him contentment on the Day of Resurrection.',
  },
  {
    id: 'm5',
    category: 'morning',
    arabic: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ.',
    transliteration: "Ya Hayyu Ya Qayyoomu bi-rahmatika astagheeth, aslih lee sha'nee kullahu, wa la takilnee ila nafsee tarfata 'ayn.",
    translation: 'O Ever-Living, O Sustainer of all existence, in Your mercy I seek relief. Rectify all my affairs for me, and do not leave me to myself even for the blink of an eye.',
    repeat: 1,
    reference: 'Sunan an-Nasa’i, Al-Hakim (Mustadrak)',
    virtue: 'Prophetic supplication for divine guidance, protection from self-reliance, and perpetual mercy.',
  },
  {
    id: 'm6',
    category: 'morning',
    arabic: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لاَ إِلَهَ إِلاَّ أَنْتَ.',
    transliteration: "Allahumma 'aafinee fee badanee, Allahumma 'aafinee fee sam'ee, Allahumma 'aafinee fee basaree, la ilaha illa Ant. Allahumma innee a'oodhu bika minal-kufri wal-faqr, wa a'oodhu bika min 'adhabal-qabr, la ilaha illa Ant.",
    translation: 'O Allah, grant well-being to my body. O Allah, grant well-being to my hearing. O Allah, grant well-being to my sight. None has the right to be worshipped except You. O Allah, I seek refuge in You from disbelief and poverty, and I seek refuge in You from the punishment of the grave. None has the right to be worshipped except You.',
    repeat: 3,
    reference: 'Sunan Abi Dawud (5090)',
    virtue: 'Protects the senses and health and shields from poverty, spiritual distress, and torment.',
  },
  {
    id: 'm7',
    category: 'morning',
    arabic: 'حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.',
    transliteration: "Hasbiyallahu la ilaha illa Huwa 'alayhi tawakkaltu wa Huwa Rabbul-'Arshil-'Azeem.",
    translation: 'Allah is sufficient for me; none has the right to be worshipped except Him. In Him I put my trust, and He is the Lord of the Mighty Throne.',
    repeat: 7,
    reference: 'Surah At-Tawbah 9:129, Sunan Abi Dawud (5081)',
    virtue: 'Whoever recites this 7 times in the morning and evening, Allah will suffice him in whatever worries him in this world and the Hereafter.',
  },

  // ==========================================
  // EVENING AZKAR (أذكار المساء)
  // ==========================================
  {
    id: 'e1',
    category: 'evening',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا.',
    transliteration: "Amsayna wa amsal-mulku lillah, wal-hamdu lillah, la ilaha illallahu wahdahu la shareeka lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadeer. Rabbi as'aluka khayra ma fee hadhihil-laylati wa khayra ma ba'daha, wa a'oodhu bika min sharri ma fee hadhihil-laylati wa sharri ma ba'daha.",
    translation: 'We have entered the evening and the kingdom belongs to Allah, and all praise is for Allah. None has the right to be worshipped except Allah alone, without partner. To Him belongs all sovereignty and praise, and He has power over all things. My Lord, I ask You for the good of this night and what comes after it, and I seek refuge in You from the evil of this night and what comes after it.',
    repeat: 1,
    reference: 'Sahih Muslim (2723)',
    virtue: 'Entrusts the night and future hours into the care of the Almighty Creator.',
  },
  {
    id: 'e2',
    category: 'evening',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.',
    transliteration: "A'oodhu bi-kalimatil-lahit-tammati min sharri ma khalaq.",
    translation: 'I seek refuge in the perfect words of Allah from the evil of what He has created.',
    repeat: 3,
    reference: 'Sahih Muslim (2709)',
    virtue: 'No venomous bite, harm, or unseen evil will touch the reciter throughout the entire night.',
  },
  {
    id: 'e3',
    category: 'evening',
    arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ.',
    transliteration: "Allahumma bika amsayna, wa bika asbahna, wa bika nahya, wa bika namootu, wa ilaykal-maseer.",
    translation: 'O Allah, by You we enter the evening, and by You we enter the morning, by You we live, and by You we die, and to You is the final return.',
    repeat: 1,
    reference: 'Jami at-Tirmidhi (3391)',
    virtue: 'Daily renewal of purpose, mortality awareness, and surrender to Allah.',
  },
  {
    id: 'e4',
    category: 'evening',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ.',
    transliteration: "Subhanallahi wa bihamdihi 'adada khalqihi, wa rida nafsihi, wa zinata 'arshihi, wa midada kalimatih.",
    translation: 'Glory be to Allah and all praise is due to Him, as many times as the number of His creation, according to His pleasure, equal to the weight of His Throne, and like the ink of His words.',
    repeat: 3,
    reference: 'Sahih Muslim (2726)',
    virtue: 'Outweighs hours of continuous ordinary dhikr in divine rewards.',
  },

  // ==========================================
  // AFTER SALAH (أذكار بعد الصلاة)
  // ==========================================
  {
    id: 'p1',
    category: 'after-prayer',
    arabic: 'أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ. اللَّهُمَّ أَنْتَ السَّلاَمُ وَمِنْكَ السَّلاَمُ، تَبَارَكْتَ يَا ذَا الْجَلاَلِ وَالإِكْرَامِ.',
    transliteration: "Astaghfirullah, Astaghfirullah, Astaghfirullah. Allahumma Antas-Salamu wa minkas-salam, tabarakta ya Dhal-Jalali wal-Ikram.",
    translation: 'I seek forgiveness from Allah (3 times). O Allah, You are Peace, and from You comes peace. Blessed are You, O Possessor of Majesty and Honor.',
    repeat: 1,
    reference: 'Sahih Muslim (591)',
    virtue: 'Recited immediately upon completing the final taslim of obligatory prayers.',
  },
  {
    id: 'p2',
    category: 'after-prayer',
    arabic: 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. اللَّهُمَّ لاَ مَانِعَ لِمَا أَعْطَيْتَ، وَلاَ مُعْطِيَ لِمَا مَنَعْتَ، وَلاَ يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ.',
    transliteration: "La ilaha illallahu wahdahu la shareeka lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadeer. Allahumma la mani'a lima a'tayt, wa la mu'tiya lima mana't, wa la yanfa'u dhal-jaddi minkal-jadd.",
    translation: 'None has the right to be worshipped except Allah alone, without partner. To Him belongs all sovereignty and praise, and He has power over all things. O Allah, none can withhold what You give, nor can any give what You withhold, and fortune cannot benefit a fortunate person against You.',
    repeat: 1,
    reference: 'Sahih al-Bukhari (844), Sahih Muslim (593)',
    virtue: 'Sunnah remembrance after fard prayer establishing total contentment with Allah’s decree.',
  },
  {
    id: 'p3',
    category: 'after-prayer',
    arabic: 'سُبْحَانَ اللَّهِ (٣٣) ، الْحَمْدُ لِلَّهِ (٣٣) ، اللَّهُ أَكْبَرُ (٣٣) ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ (١).',
    transliteration: "SubhanAllah (33x), Alhamdulillah (33x), Allahu Akbar (33x), La ilaha illallahu wahdahu la shareeka lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadeer (1x).",
    translation: 'Glory be to Allah (33 times), Praise be to Allah (33 times), Allah is the Greatest (33 times). Completed with: None has the right to be worshipped except Allah alone, without partner...',
    repeat: 33,
    reference: 'Sahih Muslim (597)',
    virtue: 'Whoever recites this after every prayer, his sins will be forgiven even if they are like the foam of the sea.',
  },
  {
    id: 'p4',
    category: 'after-prayer',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ.',
    transliteration: "Allahu la ilaha illa Huwal-Hayyul-Qayyoom. La ta'khudhuhu sinatun wa la nawm. Lahu ma fis-samawati wa ma fil-ard. Man dhal-ladhee yashfa'u 'indahu illa bi-idhnih. Ya'lamu ma bayna aydeehim wa ma khalfahum, wa la yuheetoona bi-shay'im-min 'ilmihi illa bima shaa'. Wasi'a Kursiyyuhus-samawati wal-ard, wa la ya'ooduhu hifzuhuma, wa Huwal-'Aliyyul-'Azeem.",
    translation: 'Allah - there is no deity except Him, the Ever-Living, the Sustainer of all existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth... And He is the Most High, the Most Great.',
    repeat: 1,
    reference: 'Ayat al-Kursi (Surah Al-Baqarah 2:255), Sunan an-Nasa’i',
    virtue: 'Whoever recites Ayat al-Kursi after every obligatory prayer, nothing stands between him and entering Paradise except death.',
  },

  // ==========================================
  // BEFORE SLEEPING (أذكار النوم)
  // ==========================================
  {
    id: 's1',
    category: 'sleep',
    arabic: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.',
    transliteration: "Bismika Rabbi wada'tu janbee, wa bika arfa'uh, fa-in amsakta nafsee farhamha, wa in arsaltaha fahfazha bima tahfazu bihi 'ibadakas-saliheen.",
    translation: 'In Your name my Lord, I lie down, and by Your power I rise. If You take my soul, have mercy upon it, and if You return it, protect it as You protect Your righteous servants.',
    repeat: 1,
    reference: 'Sahih al-Bukhari (6320), Sahih Muslim (2714)',
    virtue: 'Brings immense tranquility and places the sleeper under divine safeguarding throughout sleep.',
  },
  {
    id: 's2',
    category: 'sleep',
    arabic: 'اللَّهُمَّ إِنَّكَ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَحْيَيْتَهَا فَاحْفَظْهَا، وَإِنْ أَمَتَّهَا فَاغْفِرْ لَهَا. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ.',
    transliteration: "Allahumma innaka khalaqta nafsee wa Anta tawaffaha, laka mamatuha wa mahyaha, in ahyaytaha fahfazha, wa in amattaha faghfir laha. Allahumma innee as'alukal-'aafiyah.",
    translation: 'O Allah, You created my soul and You take it back. To You belong its life and death. If You grant it life, protect it, and if You cause it to die, forgive it. O Allah, I ask You for well-being.',
    repeat: 1,
    reference: 'Sahih Muslim (2712)',
    virtue: 'Supplication placing life, death, and forgiveness in the hands of the Creator.',
  },
  {
    id: 's3',
    category: 'sleep',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.',
    transliteration: 'Bismikallahumma amootu wa ahya.',
    translation: 'In Your name, O Allah, I die and I live.',
    repeat: 1,
    reference: 'Sahih al-Bukhari (6324)',
    virtue: 'The concise sunnah supplication when closing one’s eyes for sleep.',
  },

  // ==========================================
  // DAILY TASBIH & ISTIGHFAR (تسابيح واستغفار)
  // ==========================================
  {
    id: 't1',
    category: 'tasbih',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ.',
    transliteration: 'Subhanallahi wa bihamdihi, Subhanallahil-Azeem.',
    translation: 'Glory be to Allah and all praise is due to Him; Glory be to Allah the Magnificent.',
    repeat: 100,
    reference: 'Sahih al-Bukhari (6406), Sahih Muslim (2694)',
    virtue: 'Two words that are light on the tongue, heavy on the Scales of Good Deeds, and beloved to the Most Merciful.',
  },
  {
    id: 't2',
    category: 'tasbih',
    arabic: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ.',
    transliteration: 'Astaghfirullaha wa atoobu ilayh.',
    translation: 'I seek the forgiveness of Allah and turn to Him in sincere repentance.',
    repeat: 100,
    reference: 'Sahih al-Bukhari (6307), Sahih Muslim (2702)',
    virtue: 'The Prophet (ﷺ) sought forgiveness and repented to Allah more than seventy to a hundred times daily.',
  },
  {
    id: 't3',
    category: 'tasbih',
    arabic: 'لاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ.',
    transliteration: 'La hawla wa la quwwata illa billah.',
    translation: 'There is no power and no strength except through Allah.',
    repeat: 33,
    reference: 'Sahih al-Bukhari (6384), Sahih Muslim (2704)',
    virtue: 'A precious treasure from beneath the Throne of the Most Merciful (treasure of Paradise).',
  },
  {
    id: 't4',
    category: 'tasbih',
    arabic: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ.',
    transliteration: 'Allahumma salli wa sallim ‘ala Nabiyyina Muhammad.',
    translation: 'O Allah, send Your peace, blessings, and salutations upon our Prophet Muhammad.',
    repeat: 10,
    reference: 'Sahih Muslim (408), At-Tirmidhi',
    virtue: 'Whoever sends blessings upon the Prophet (ﷺ) once, Allah will send blessings upon him ten times and remove ten sins.',
  },
];
