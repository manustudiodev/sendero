import { useEffect } from "react";
import { BrandMark } from "../components.jsx";
import { hrefForLocale, LanguageSelector, useUiLocale } from "../i18n/LanguageSelector.jsx";

const COPY = {
  en: {
    skip: "Skip to content", home: "Sendero, home", back: "Back to home", kicker: "LEGAL INFORMATION",
    privacyTitle: "Privacy", termsTitle: "Terms of use",
    privacyIntro: "This policy explains what information Sendero processes and what happens when you share a trip.",
    termsIntro: "These terms define responsible use of Sendero and the scope of its travel information.",
    updated: "Last updated: September 1, 2026", legalNav: "Legal information", privacy: "Privacy", terms: "Terms",
    mapsPrivacy: "When you search for a destination, Sendero sends the text you type and the interface language to Google Maps to return city and country suggestions. Google processes that request under its Privacy Policy.",
    mapsTerms: "Destination suggestions are Google Maps content and are also subject to the Google Maps Platform Terms of Service.",
    privacySections: [
      ["1. Information Sendero processes", "When you create an account, we may receive basic identity data such as your name, email address, and identifiers from the sign-in provider.", "When you plan a trip, we process the information you choose to share: destinations, dates, preferences, travellers, mobility, lodging, activities, notes, bookings, and itinerary changes.", "We may also record the minimum technical data needed to operate and protect the service, such as timestamps, access actions, errors, and security logs."],
      ["2. How we use information", "We use it to create and preserve itineraries, display interactive components, synchronize authorized changes, manage collaborators, resolve shared links, and keep the service secure.", "We do not make private trip content public. Publishing or inviting another person requires an explicit action."],
      ["3. Shared trips", "A public link displays a version prepared for sharing. It must exclude private information such as the exact lodging address, internal notes, collaborators, and technical identifiers.", "Anyone who obtains a current public link can open it. Its creator can update or replace it, set an expiry, or revoke it.", "Restricted trips require an authorized account. The assigned permission determines whether a person can view or collaborate."],
      ["4. Providers and external services", "Sendero uses infrastructure, authentication, storage, and map providers to deliver the service. Booking, transport, event, and venue links lead to independent services with their own terms.", "We share only the information those providers need to perform the requested function."],
      ["5. Retention, control, and security", "We retain information while the account or trip remains active and for the reasonable period required for security, continuity, and applicable obligations.", "You can stop sharing a link, remove collaborators, or request account closure. We apply technical and organizational safeguards, although no connected system can guarantee absolute security."],
      ["6. Changes and questions", "We may update this policy when features or applicable requirements change. The published version will show its latest update date.", "Privacy questions are handled through the support channel available in Sendero."],
    ],
    termsSections: [
      ["1. The service", "Sendero helps create, organize, view, and share itineraries through a conversational experience. The website complements that conversation with informational pages and shared-trip views.", "By using Sendero, you accept these terms and the privacy policy."],
      ["2. Account and access", "You are responsible for keeping your account secure and for actions performed through it. Do not share credentials or attempt to access trips without authorization.", "A trip owner can grant view-only or collaborator access and can change or remove that access."],
      ["3. Travel information", "Sendero may rely on public sources and external services to present schedules, weather, events, routes, availability, and booking requirements. That information can change or contain errors.", "Before travelling, booking, or paying, verify critical information directly with the relevant provider. Sendero is not a travel agency and does not purchase or book on your behalf unless a feature expressly says so."],
      ["4. Content and shared links", "You remain responsible for the information you enter and share. You must have the right to use it and avoid unnecessary sensitive data.", "If you publish a link, anyone who obtains it can access it while it is active. You are responsible for choosing the right audience and revoking it when it should no longer be available."],
      ["5. Acceptable use", "You may not use Sendero to violate rights, distribute unlawful content, interfere with the service, bypass access controls, automate abuse, or obtain other people's information without authorization."],
      ["6. Availability and liability", "The service may change, be interrupted, or stop offering certain features. Sendero is a planning tool and does not guarantee the availability, accuracy, or suitability of external providers.", "Nothing in these terms limits rights that cannot be excluded under applicable law."],
      ["7. Changes and termination", "We may update these terms and suspend accounts that violate them or compromise service security. The published version will show its update date.", "Questions about these terms are handled through the support channel available in Sendero."],
    ],
  },
  es: {
    skip: "Saltar al contenido", home: "Sendero, inicio", back: "Volver al inicio", kicker: "INFORMACIÓN LEGAL",
    privacyTitle: "Privacidad", termsTitle: "Términos de uso",
    privacyIntro: "Esta política explica qué información trata Sendero y qué ocurre cuando compartes un viaje.",
    termsIntro: "Estas condiciones definen el uso responsable de Sendero y el alcance de la información de viaje.",
    updated: "Última actualización: 1 de septiembre de 2026", legalNav: "Información legal", privacy: "Privacidad", terms: "Términos",
    mapsPrivacy: "Cuando buscas un destino, Sendero envía a Google Maps el texto que escribes y el idioma de la interfaz para devolver sugerencias de ciudades y países. Google trata esa solicitud conforme a su Política de Privacidad.",
    mapsTerms: "Las sugerencias de destinos son contenido de Google Maps y también están sujetas a los Términos del Servicio de Google Maps Platform.",
    privacySections: [
      ["1. Qué información trata Sendero", "Cuando creas una cuenta, podemos recibir datos básicos de identidad como nombre, correo electrónico e identificadores del proveedor de acceso.", "Cuando planificas un viaje, tratamos la información que decides compartir: destinos, fechas, preferencias, acompañantes, movilidad, alojamiento, actividades, notas, reservas y cambios del itinerario.", "También podemos registrar datos técnicos mínimos para operar y proteger el servicio, como marcas de tiempo, acciones de acceso, errores y registros de seguridad."],
      ["2. Para qué usamos la información", "La usamos para crear y conservar itinerarios, mostrar componentes interactivos, sincronizar cambios autorizados, gestionar colaboradores, resolver enlaces compartidos y mantener la seguridad del servicio.", "No usamos el contenido privado de un viaje para hacerlo público. Publicar o invitar a otra persona requiere una acción explícita."],
      ["3. Viajes compartidos", "Un enlace público muestra una versión preparada para compartir. Debe excluir datos privados como la dirección precisa del alojamiento, notas internas, colaboradores e identificadores técnicos.", "Cualquier persona que obtenga un enlace público vigente puede abrirlo. Quien lo creó puede actualizarlo, reemplazarlo, establecer una vigencia o revocarlo.", "Los viajes restringidos requieren una cuenta autorizada. El permiso asignado determina si una persona puede visualizar o colaborar."],
      ["4. Proveedores y servicios externos", "Sendero utiliza proveedores de infraestructura, autenticación, almacenamiento y mapas para prestar el servicio. Cada enlace de reserva, transporte, evento o establecimiento conduce a un servicio independiente con sus propias condiciones.", "Compartimos con esos proveedores únicamente la información necesaria para ejecutar la función solicitada."],
      ["5. Conservación, control y seguridad", "Conservamos la información mientras la cuenta o el viaje sigan activos y durante el tiempo razonablemente necesario para seguridad, continuidad y cumplimiento de obligaciones aplicables.", "Puedes dejar de compartir un enlace, retirar colaboradores o solicitar el cierre de tu cuenta. Aplicamos controles técnicos y organizativos para proteger la información, aunque ningún sistema conectado puede garantizar seguridad absoluta."],
      ["6. Cambios y consultas", "Podemos actualizar esta política cuando cambien las funciones o los requisitos aplicables. La versión publicada indicará la fecha de la última actualización.", "Las consultas sobre privacidad se gestionan mediante el canal de soporte disponible en Sendero."],
    ],
    termsSections: [
      ["1. El servicio", "Sendero ayuda a crear, organizar, visualizar y compartir itinerarios mediante una experiencia conversacional. La web complementa esa conversación con páginas informativas y vistas de viajes compartidos.", "Al usar Sendero aceptas estas condiciones y la política de privacidad."],
      ["2. Cuenta y acceso", "Eres responsable de mantener segura tu cuenta y de las acciones realizadas desde ella. No debes compartir credenciales ni intentar acceder a viajes para los que no tienes autorización.", "El propietario de un viaje puede conceder acceso de solo lectura o colaboración y puede modificar o retirar ese acceso."],
      ["3. Información de viaje", "Sendero puede apoyarse en fuentes públicas y servicios externos para presentar horarios, clima, eventos, rutas, disponibilidad y requisitos de reserva. Esa información puede cambiar o contener errores.", "Antes de desplazarte, reservar o pagar, verifica la información crítica directamente con el proveedor correspondiente. Sendero no es una agencia de viajes ni celebra la compra o reserva en tu nombre salvo que una función lo indique de forma expresa."],
      ["4. Contenido y enlaces compartidos", "Conservas la responsabilidad sobre la información que introduces y compartes. Debes tener derecho a usarla y evitar incluir datos sensibles innecesarios.", "Si publicas un enlace, cualquier persona que lo obtenga puede acceder mientras esté activo. Eres responsable de elegir la audiencia adecuada y revocarlo cuando ya no deba estar disponible."],
      ["5. Uso aceptable", "No puedes usar Sendero para vulnerar derechos, distribuir contenido ilícito, interferir con el servicio, evadir controles de acceso, automatizar abuso ni obtener información de otras personas sin autorización."],
      ["6. Disponibilidad y responsabilidad", "El servicio puede cambiar, interrumpirse o dejar de ofrecer determinadas funciones. Sendero se ofrece como herramienta de planificación y no garantiza disponibilidad, exactitud ni idoneidad de proveedores externos.", "Nada en estas condiciones limita derechos que no puedan excluirse conforme a la legislación aplicable."],
      ["7. Cambios y terminación", "Podemos actualizar estas condiciones y suspender cuentas que incumplan estas reglas o comprometan la seguridad del servicio. La versión publicada mostrará su fecha de actualización.", "Las consultas sobre estas condiciones se gestionan mediante el canal de soporte disponible en Sendero."],
    ],
  },
  pt: {
    skip: "Pular para o conteúdo", home: "Sendero, início", back: "Voltar ao início", kicker: "INFORMAÇÕES LEGAIS",
    privacyTitle: "Privacidade", termsTitle: "Termos de uso",
    privacyIntro: "Esta política explica quais informações o Sendero processa e o que acontece quando você compartilha uma viagem.",
    termsIntro: "Estes termos definem o uso responsável do Sendero e o alcance das informações de viagem.",
    updated: "Última atualização: 1 de setembro de 2026", legalNav: "Informações legais", privacy: "Privacidade", terms: "Termos",
    mapsPrivacy: "Ao buscar um destino, o Sendero envia ao Google Maps o texto digitado e o idioma da interface para obter sugestões de cidades e países. O Google processa essa solicitação de acordo com sua Política de Privacidade.",
    mapsTerms: "As sugestões de destinos são conteúdo do Google Maps e também estão sujeitas aos Termos de Serviço da Google Maps Platform.",
    privacySections: [
      ["1. Quais informações o Sendero processa", "Ao criar uma conta, podemos receber dados básicos de identidade, como nome, e-mail e identificadores do provedor de acesso.", "Ao planejar uma viagem, processamos as informações que você decide compartilhar: destinos, datas, preferências, acompanhantes, mobilidade, hospedagem, atividades, notas, reservas e alterações no roteiro.", "Também podemos registrar os dados técnicos mínimos para operar e proteger o serviço, como horários, ações de acesso, erros e registros de segurança."],
      ["2. Como usamos as informações", "Usamos essas informações para criar e conservar roteiros, mostrar componentes interativos, sincronizar alterações autorizadas, gerenciar colaboradores, resolver links compartilhados e manter a segurança do serviço.", "Não tornamos público o conteúdo privado de uma viagem. Publicar ou convidar outra pessoa exige uma ação explícita."],
      ["3. Viagens compartilhadas", "Um link público mostra uma versão preparada para compartilhamento. Ela deve excluir dados privados, como o endereço exato da hospedagem, notas internas, colaboradores e identificadores técnicos.", "Qualquer pessoa que obtenha um link público vigente pode abri-lo. Quem o criou pode atualizá-lo, substituí-lo, definir uma validade ou revogá-lo.", "Viagens restritas exigem uma conta autorizada. A permissão determina se a pessoa pode visualizar ou colaborar."],
      ["4. Provedores e serviços externos", "O Sendero usa provedores de infraestrutura, autenticação, armazenamento e mapas. Links de reservas, transporte, eventos ou estabelecimentos levam a serviços independentes com seus próprios termos.", "Compartilhamos apenas as informações necessárias para executar a função solicitada."],
      ["5. Retenção, controle e segurança", "Conservamos as informações enquanto a conta ou a viagem estiver ativa e pelo período razoavelmente necessário para segurança, continuidade e obrigações aplicáveis.", "Você pode deixar de compartilhar um link, remover colaboradores ou solicitar o encerramento da conta. Aplicamos controles técnicos e organizacionais, embora nenhum sistema conectado garanta segurança absoluta."],
      ["6. Alterações e dúvidas", "Podemos atualizar esta política quando as funcionalidades ou os requisitos aplicáveis mudarem. A versão publicada mostrará a data da última atualização.", "Dúvidas sobre privacidade são tratadas pelo canal de suporte disponível no Sendero."],
    ],
    termsSections: [
      ["1. O serviço", "O Sendero ajuda a criar, organizar, visualizar e compartilhar roteiros por meio de uma experiência conversacional. A web complementa essa conversa com páginas informativas e visualizações de viagens compartilhadas.", "Ao usar o Sendero, você aceita estes termos e a política de privacidade."],
      ["2. Conta e acesso", "Você é responsável por manter sua conta segura e pelas ações realizadas nela. Não compartilhe credenciais nem tente acessar viagens sem autorização.", "O proprietário de uma viagem pode conceder acesso de visualização ou colaboração e pode alterar ou remover esse acesso."],
      ["3. Informações de viagem", "O Sendero pode usar fontes públicas e serviços externos para apresentar horários, clima, eventos, rotas, disponibilidade e requisitos de reserva. Essas informações podem mudar ou conter erros.", "Antes de viajar, reservar ou pagar, confirme as informações críticas diretamente com o provedor. O Sendero não é uma agência de viagens e não compra ou reserva em seu nome, salvo indicação expressa de uma funcionalidade."],
      ["4. Conteúdo e links compartilhados", "Você continua responsável pelas informações que insere e compartilha. Deve ter o direito de usá-las e evitar dados sensíveis desnecessários.", "Ao publicar um link, qualquer pessoa que o obtenha pode acessá-lo enquanto estiver ativo. Você é responsável por escolher o público adequado e revogá-lo quando necessário."],
      ["5. Uso aceitável", "Você não pode usar o Sendero para violar direitos, distribuir conteúdo ilegal, interferir no serviço, contornar controles de acesso, automatizar abusos ou obter informações de terceiros sem autorização."],
      ["6. Disponibilidade e responsabilidade", "O serviço pode mudar, ser interrompido ou deixar de oferecer certas funções. O Sendero é uma ferramenta de planejamento e não garante disponibilidade, precisão ou adequação de provedores externos.", "Nada nestes termos limita direitos que não possam ser excluídos pela legislação aplicável."],
      ["7. Alterações e encerramento", "Podemos atualizar estes termos e suspender contas que os violem ou comprometam a segurança do serviço. A versão publicada mostrará sua data de atualização.", "Dúvidas sobre estes termos são tratadas pelo canal de suporte disponível no Sendero."],
    ],
  },
  fr: {
    skip: "Aller au contenu", home: "Sendero, accueil", back: "Retour à l’accueil", kicker: "INFORMATIONS LÉGALES",
    privacyTitle: "Confidentialité", termsTitle: "Conditions d’utilisation",
    privacyIntro: "Cette politique explique quelles informations Sendero traite et ce qui se passe lorsque vous partagez un voyage.",
    termsIntro: "Ces conditions définissent l’utilisation responsable de Sendero et la portée de ses informations de voyage.",
    updated: "Dernière mise à jour : 1er septembre 2026", legalNav: "Informations légales", privacy: "Confidentialité", terms: "Conditions",
    mapsPrivacy: "Lorsque vous recherchez une destination, Sendero transmet à Google Maps le texte saisi et la langue de l’interface afin d’obtenir des suggestions de villes et de pays. Google traite cette requête conformément à sa Politique de confidentialité.",
    mapsTerms: "Les suggestions de destinations constituent du contenu Google Maps et sont également soumises aux Conditions d’utilisation de Google Maps Platform.",
    privacySections: [
      ["1. Informations traitées par Sendero", "Lorsque vous créez un compte, nous pouvons recevoir des données d’identité de base, comme votre nom, votre adresse e-mail et les identifiants fournis par le service de connexion.", "Lorsque vous planifiez un voyage, nous traitons les informations que vous choisissez de partager : destinations, dates, préférences, voyageurs, mobilité, hébergement, activités, notes, réservations et modifications de l’itinéraire.", "Nous pouvons aussi enregistrer les données techniques minimales nécessaires au fonctionnement et à la protection du service, telles que les horodatages, les actions d’accès, les erreurs et les journaux de sécurité."],
      ["2. Utilisation des informations", "Nous les utilisons pour créer et conserver des itinéraires, afficher des composants interactifs, synchroniser les modifications autorisées, gérer les collaborateurs, résoudre les liens partagés et assurer la sécurité du service.", "Nous ne rendons pas public le contenu privé d’un voyage. Publier ou inviter une autre personne exige une action explicite."],
      ["3. Voyages partagés", "Un lien public affiche une version préparée pour le partage. Elle doit exclure les informations privées telles que l’adresse exacte de l’hébergement, les notes internes, les collaborateurs et les identifiants techniques.", "Toute personne qui obtient un lien public actif peut l’ouvrir. Son créateur peut l’actualiser ou le remplacer, définir une date d’expiration ou le révoquer.", "Les voyages restreints nécessitent un compte autorisé. Le niveau d’accès attribué détermine si une personne peut consulter ou collaborer."],
      ["4. Prestataires et services externes", "Sendero utilise des prestataires d’infrastructure, d’authentification, de stockage et de cartographie pour fournir le service. Les liens de réservation, transport, événement ou établissement mènent à des services indépendants soumis à leurs propres conditions.", "Nous ne partageons avec ces prestataires que les informations nécessaires à l’exécution de la fonction demandée."],
      ["5. Conservation, contrôle et sécurité", "Nous conservons les informations tant que le compte ou le voyage reste actif, puis pendant la durée raisonnablement nécessaire à la sécurité, à la continuité et au respect des obligations applicables.", "Vous pouvez cesser de partager un lien, retirer des collaborateurs ou demander la fermeture de votre compte. Nous appliquons des mesures techniques et organisationnelles, même si aucun système connecté ne peut garantir une sécurité absolue."],
      ["6. Modifications et questions", "Nous pouvons actualiser cette politique lorsque les fonctionnalités ou les exigences applicables évoluent. La version publiée indiquera sa dernière date de mise à jour.", "Les questions relatives à la confidentialité sont traitées par le canal d’assistance disponible dans Sendero."],
    ],
    termsSections: [
      ["1. Le service", "Sendero aide à créer, organiser, consulter et partager des itinéraires grâce à une expérience conversationnelle. Le site complète cette conversation avec des pages d’information et des vues de voyages partagés.", "En utilisant Sendero, vous acceptez ces conditions et la politique de confidentialité."],
      ["2. Compte et accès", "Vous êtes responsable de la sécurité de votre compte et des actions effectuées depuis celui-ci. Ne partagez pas vos identifiants et n’essayez pas d’accéder à des voyages sans autorisation.", "Le propriétaire d’un voyage peut accorder un accès en lecture seule ou en collaboration, et peut modifier ou retirer cet accès."],
      ["3. Informations de voyage", "Sendero peut s’appuyer sur des sources publiques et des services externes pour présenter les horaires, la météo, les événements, les trajets, les disponibilités et les exigences de réservation. Ces informations peuvent évoluer ou comporter des erreurs.", "Avant de vous déplacer, réserver ou payer, vérifiez les informations essentielles directement auprès du prestataire concerné. Sendero n’est pas une agence de voyages et n’achète ni ne réserve en votre nom, sauf indication explicite d’une fonctionnalité."],
      ["4. Contenu et liens partagés", "Vous restez responsable des informations que vous saisissez et partagez. Vous devez avoir le droit de les utiliser et éviter les données sensibles inutiles.", "Si vous publiez un lien, toute personne qui l’obtient peut y accéder tant qu’il reste actif. Vous êtes responsable du choix du public approprié et de sa révocation lorsqu’il ne doit plus être disponible."],
      ["5. Utilisation acceptable", "Vous ne pouvez pas utiliser Sendero pour enfreindre des droits, diffuser du contenu illicite, perturber le service, contourner les contrôles d’accès, automatiser des abus ou obtenir sans autorisation les informations d’autres personnes."],
      ["6. Disponibilité et responsabilité", "Le service peut évoluer, être interrompu ou cesser de proposer certaines fonctionnalités. Sendero est un outil de planification et ne garantit ni la disponibilité, ni l’exactitude, ni l’adéquation des prestataires externes.", "Aucune disposition de ces conditions ne limite les droits qui ne peuvent être exclus en vertu de la loi applicable."],
      ["7. Modifications et résiliation", "Nous pouvons actualiser ces conditions et suspendre les comptes qui les enfreignent ou compromettent la sécurité du service. La version publiée indiquera sa date de mise à jour.", "Les questions relatives à ces conditions sont traitées par le canal d’assistance disponible dans Sendero."],
    ],
  },
  de: {
    skip: "Zum Inhalt springen", home: "Sendero, Startseite", back: "Zurück zur Startseite", kicker: "RECHTLICHE INFORMATIONEN",
    privacyTitle: "Datenschutz", termsTitle: "Nutzungsbedingungen",
    privacyIntro: "Diese Richtlinie erklärt, welche Informationen Sendero verarbeitet und was beim Teilen einer Reise geschieht.",
    termsIntro: "Diese Bedingungen legen die verantwortungsvolle Nutzung von Sendero und den Umfang der Reiseinformationen fest.",
    updated: "Zuletzt aktualisiert: 1. September 2026", legalNav: "Rechtliche Informationen", privacy: "Datenschutz", terms: "Nutzungsbedingungen",
    mapsPrivacy: "Bei der Suche nach einem Reiseziel sendet Sendero den eingegebenen Text und die Sprache der Benutzeroberfläche an Google Maps, um Vorschläge für Städte und Länder abzurufen. Google verarbeitet diese Anfrage gemäß seiner Datenschutzerklärung.",
    mapsTerms: "Zielvorschläge sind Inhalte von Google Maps und unterliegen zusätzlich den Nutzungsbedingungen der Google Maps Platform.",
    privacySections: [
      ["1. Von Sendero verarbeitete Informationen", "Wenn du ein Konto erstellst, können wir grundlegende Identitätsdaten wie deinen Namen, deine E-Mail-Adresse und Kennungen des Anmeldeanbieters erhalten.", "Wenn du eine Reise planst, verarbeiten wir die Informationen, die du teilen möchtest: Reiseziele, Daten, Vorlieben, Reisende, Mobilität, Unterkunft, Aktivitäten, Notizen, Buchungen und Änderungen am Reiseplan.", "Wir können außerdem die für Betrieb und Schutz des Dienstes mindestens erforderlichen technischen Daten erfassen, etwa Zeitstempel, Zugriffsaktionen, Fehler und Sicherheitsprotokolle."],
      ["2. Verwendung der Informationen", "Wir verwenden sie, um Reisepläne zu erstellen und zu erhalten, interaktive Komponenten anzuzeigen, autorisierte Änderungen zu synchronisieren, Mitwirkende zu verwalten, geteilte Links aufzulösen und den Dienst zu schützen.", "Wir machen private Reiseinhalte nicht öffentlich. Das Veröffentlichen oder Einladen einer anderen Person erfordert eine ausdrückliche Handlung."],
      ["3. Geteilte Reisen", "Ein öffentlicher Link zeigt eine zum Teilen vorbereitete Version. Sie muss private Informationen wie die genaue Unterkunftsadresse, interne Notizen, Mitwirkende und technische Kennungen ausschließen.", "Jede Person mit einem aktiven öffentlichen Link kann ihn öffnen. Die erstellende Person kann ihn aktualisieren oder ersetzen, ein Ablaufdatum setzen oder ihn widerrufen.", "Eingeschränkte Reisen erfordern ein autorisiertes Konto. Die zugewiesene Berechtigung bestimmt, ob eine Person ansehen oder mitwirken kann."],
      ["4. Anbieter und externe Dienste", "Sendero nutzt Infrastruktur-, Authentifizierungs-, Speicher- und Kartenanbieter, um den Dienst bereitzustellen. Links zu Buchungen, Verkehrsmitteln, Veranstaltungen oder Orten führen zu unabhängigen Diensten mit eigenen Bedingungen.", "Wir teilen mit diesen Anbietern nur die Informationen, die zur Ausführung der angeforderten Funktion erforderlich sind."],
      ["5. Aufbewahrung, Kontrolle und Sicherheit", "Wir bewahren Informationen auf, solange das Konto oder die Reise aktiv ist, sowie für einen angemessenen Zeitraum, der für Sicherheit, Kontinuität und geltende Verpflichtungen erforderlich ist.", "Du kannst das Teilen eines Links beenden, Mitwirkende entfernen oder die Schließung deines Kontos beantragen. Wir wenden technische und organisatorische Schutzmaßnahmen an, auch wenn kein vernetztes System absolute Sicherheit garantieren kann."],
      ["6. Änderungen und Fragen", "Wir können diese Richtlinie aktualisieren, wenn sich Funktionen oder geltende Anforderungen ändern. Die veröffentlichte Version zeigt das Datum der letzten Aktualisierung.", "Datenschutzfragen werden über den in Sendero verfügbaren Supportkanal bearbeitet."],
    ],
    termsSections: [
      ["1. Der Dienst", "Sendero hilft dabei, Reisepläne in einer dialogorientierten Erfahrung zu erstellen, zu organisieren, anzusehen und zu teilen. Die Website ergänzt diese Unterhaltung mit Informationsseiten und Ansichten geteilter Reisen.", "Mit der Nutzung von Sendero akzeptierst du diese Bedingungen und die Datenschutzrichtlinie."],
      ["2. Konto und Zugriff", "Du bist dafür verantwortlich, dein Konto zu schützen, und trägst die Verantwortung für darüber ausgeführte Handlungen. Teile keine Anmeldedaten und versuche nicht, ohne Berechtigung auf Reisen zuzugreifen.", "Der Eigentümer einer Reise kann Lese- oder Mitwirkungszugriff gewähren und diesen Zugriff ändern oder entfernen."],
      ["3. Reiseinformationen", "Sendero kann öffentliche Quellen und externe Dienste verwenden, um Zeitpläne, Wetter, Veranstaltungen, Routen, Verfügbarkeit und Buchungsanforderungen anzuzeigen. Diese Informationen können sich ändern oder Fehler enthalten.", "Prüfe wichtige Informationen vor Reiseantritt, Buchung oder Zahlung direkt beim zuständigen Anbieter. Sendero ist kein Reisebüro und kauft oder bucht nicht in deinem Namen, sofern eine Funktion dies nicht ausdrücklich angibt."],
      ["4. Inhalte und geteilte Links", "Du bleibst für die von dir eingegebenen und geteilten Informationen verantwortlich. Du musst zu ihrer Nutzung berechtigt sein und unnötige sensible Daten vermeiden.", "Wenn du einen Link veröffentlichst, kann jede Person mit diesem Link darauf zugreifen, solange er aktiv ist. Du bist dafür verantwortlich, die richtige Zielgruppe zu wählen und den Link zu widerrufen, sobald er nicht mehr verfügbar sein soll."],
      ["5. Zulässige Nutzung", "Du darfst Sendero nicht verwenden, um Rechte zu verletzen, rechtswidrige Inhalte zu verbreiten, den Dienst zu stören, Zugriffskontrollen zu umgehen, Missbrauch zu automatisieren oder ohne Erlaubnis Informationen anderer Personen zu erhalten."],
      ["6. Verfügbarkeit und Haftung", "Der Dienst kann sich ändern, unterbrochen werden oder bestimmte Funktionen nicht mehr anbieten. Sendero ist ein Planungswerkzeug und garantiert weder Verfügbarkeit noch Richtigkeit oder Eignung externer Anbieter.", "Diese Bedingungen beschränken keine Rechte, die nach geltendem Recht nicht ausgeschlossen werden können."],
      ["7. Änderungen und Beendigung", "Wir können diese Bedingungen aktualisieren und Konten sperren, die gegen sie verstoßen oder die Sicherheit des Dienstes gefährden. Die veröffentlichte Version zeigt ihr Aktualisierungsdatum.", "Fragen zu diesen Bedingungen werden über den in Sendero verfügbaren Supportkanal bearbeitet."],
    ],
  },
};

export function LegalPage({ kind }) {
  const { language, locale, selectLocale } = useUiLocale();
  const copy = COPY[language] || COPY.es;
  const isPrivacy = kind === "privacy";
  const sections = isPrivacy ? copy.privacySections : copy.termsSections;
  const title = isPrivacy ? copy.privacyTitle : copy.termsTitle;

  useEffect(() => { document.title = `${title} · Sendero`; }, [title]);

  return (
    <>
      <a className="site-skip-link" href="#contenido-legal">{copy.skip}</a>
      <header className="legal-header">
        <a aria-label={copy.home} className="site-brand" href={hrefForLocale("/", locale)}><BrandMark /><span>Sendero</span></a>
        <div className="site-header-actions">
          <LanguageSelector className="site-language-selector" locale={locale} onChange={selectLocale} />
          <a className="site-text-link" href={hrefForLocale("/", locale)}>{copy.back} <span aria-hidden="true">→</span></a>
        </div>
      </header>
      <main className="legal-main" id="contenido-legal">
        <header className="legal-title">
          <p className="site-kicker">{copy.kicker}</p>
          <h1>{title}</h1>
          <p>{isPrivacy ? copy.privacyIntro : copy.termsIntro}</p>
          <time dateTime="2026-09-01">{copy.updated}</time>
        </header>
        <div className="legal-content">
          {sections.map(([sectionTitle, ...paragraphs], sectionIndex) => (
            <section key={sectionTitle}>
              <h2>{sectionTitle}</h2>
              {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {isPrivacy && sectionIndex === 3 ? (
                <p>{copy.mapsPrivacy} <a href="https://policies.google.com/privacy" rel="noreferrer" target="_blank">Google Privacy Policy ↗</a></p>
              ) : null}
              {!isPrivacy && sectionIndex === 2 ? (
                <p>{copy.mapsTerms} <a href="https://cloud.google.com/maps-platform/terms" rel="noreferrer" target="_blank">Google Maps Platform Terms of Service ↗</a></p>
              ) : null}
            </section>
          ))}
        </div>
      </main>
      <footer className="site-footer legal-footer">
        <p>Sendero</p>
        <nav aria-label={copy.legalNav}><a href={hrefForLocale("/privacy", locale)}>{copy.privacy}</a><a href={hrefForLocale("/terms", locale)}>{copy.terms}</a></nav>
      </footer>
    </>
  );
}
