import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const Imprint: React.FC = () => {
  const { language } = useLanguage();
  
  return (
    <div className="min-h-screen pt-24 pb-20 px-4 bg-brandWhite dark:bg-brandBlack">
      <div className="max-w-3xl mx-auto bg-brandWhite dark:bg-brandBlack p-8 border-4 border-brandBlack dark:border-brandWhite shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#fff]">
        
        <h1 className="text-4xl font-black text-brandBlack dark:text-brandWhite uppercase mb-8 tracking-tighter">
          {language === 'de' ? 'Impressum' : 'Imprint'}
        </h1>

        <div className="space-y-6 text-lg text-gray-800 dark:text-gray-300 font-medium">
          <div>
            <h2 className="text-xl font-black text-brandBlack dark:text-brandWhite uppercase mb-2">
               {language === 'de' ? 'Angaben gemäß § 5 TMG' : 'Information according to § 5 TMG'}
            </h2>
            <p>
              Revenue Works Ltd.<br />
              TRIQ ELUJA ZAMMIT<br />
              SOHO ST JULIANS - PUNCHBOWL CENTRE Unit No; 104<br />
              STJ 3154 SAN GILJAN<br />
              Malta
            </p>
            <p className="mt-4">
              {language === 'de' ? 'Registernummer' : 'Registration Number'}: C 111019<br />
              {language === 'de' ? 'USt-IdNr.' : 'VAT ID'}: MT31682701<br />
              {language === 'de' ? 'Registrierungsdatum' : 'Registration Date'}: 07-02-2025
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-brandBlack dark:text-brandWhite uppercase mb-2">
               {language === 'de' ? 'Kontakt' : 'Contact'}
            </h2>
            <p>
              E-Mail: hello@revenueworks.ai<br />
              Web: www.revenueworks.ai
            </p>
          </div>

           <div>
            <h2 className="text-xl font-black text-brandBlack dark:text-brandWhite uppercase mb-2">
               {language === 'de' ? 'Haftungsausschluss' : 'Disclaimer'}
            </h2>
            <p className="text-sm leading-relaxed">
                {language === 'de' 
                 ? 'Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.'
                 : 'Despite careful content control, we assume no liability for the content of external links. The operators of the linked pages are solely responsible for their content.'
                }
            </p>
          </div>

           <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-800">
             <p className="text-sm text-gray-500">
               Status: All Systems Nominal
             </p>
           </div>

        </div>
      </div>
    </div>
  );
};

export default Imprint;