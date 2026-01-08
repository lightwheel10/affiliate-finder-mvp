import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const Privacy: React.FC = () => {
  const { language } = useLanguage();
  
  return (
    <div className="min-h-screen pt-24 pb-20 px-4 bg-brandWhite dark:bg-brandBlack">
      <div className="max-w-3xl mx-auto bg-brandWhite dark:bg-brandBlack p-8 border-4 border-brandBlack dark:border-brandWhite shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#fff]">
        
        <h1 className="text-4xl font-black text-brandBlack dark:text-brandWhite uppercase mb-8 tracking-tighter">
          {language === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy'}
        </h1>

        <div className="space-y-6 text-lg text-gray-800 dark:text-gray-300 font-medium">
          <p>
             {language === 'de' 
                ? 'Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen. Wir verarbeiten Ihre Daten daher ausschließlich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, TKG 2003).'
                : 'The protection of your personal data is of particular concern to us. We therefore process your data exclusively on the basis of the legal regulations (GDPR, TKG 2003).'
             }
          </p>

          <div>
            <h2 className="text-xl font-black text-brandBlack dark:text-brandWhite uppercase mb-2">
               1. {language === 'de' ? 'Kontakt mit uns' : 'Contacting us'}
            </h2>
            <p className="text-base">
                {language === 'de'
                 ? 'Wenn Sie per Formular auf der Website oder per E-Mail Kontakt mit uns aufnehmen, werden Ihre angegebenen Daten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert.'
                 : 'If you contact us via the form on the website or by e-mail, your data will be stored for the purpose of processing the inquiry and in the event of follow-up questions.'
                }
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-brandBlack dark:text-brandWhite uppercase mb-2">
               2. {language === 'de' ? 'Datenspeicherung' : 'Data Storage'}
            </h2>
            <p className="text-base">
               {language === 'de'
                ? 'Wir speichern Daten, die für die Vertragsabwicklung notwendig sind. Eine Datenübermittlung an Dritte erfolgt nicht, mit Ausnahme der Übermittlung an unsere Dienstleister zur Abwicklung der Services.'
                : 'We store data necessary for contract processing. Data is not transferred to third parties, with the exception of the transfer to our service providers for processing services.'
               }
            </p>
          </div>

           <div>
            <h2 className="text-xl font-black text-brandBlack dark:text-brandWhite uppercase mb-2">
               3. {language === 'de' ? 'Ihre Rechte' : 'Your Rights'}
            </h2>
            <p className="text-base">
               {language === 'de'
                ? 'Ihnen stehen grundsätzlich die Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerruf und Widerspruch zu.'
                : 'In principle, you have the rights to information, correction, deletion, restriction, data portability, revocation and objection.'
               }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;