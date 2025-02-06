// Invocamos o leitor de QR Code
const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const client = new Client();

// Exibe o QR Code para conectar
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Confirma quando o bot estiver conectado
client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});

// Inicializa o cliente
client.initialize();

// Função de delay para simular digitação
const delay = ms => new Promise(res => setTimeout(res, ms));

// Função para validar o CNPJ
const validarCNPJ = (cnpj) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return cnpjLimpo.length === 14;
};

// Base de dados dos clientes
const clientData = {};

// Funil simplificado de pré-qualificação com Sophya
client.on('message', async msg => {
    // Ignorar mensagens de grupos
    if (msg.isGroupMsg) return;

    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const clientNumber = msg.from;

    // Inicialização do cliente na base de dados
    if (!clientData[clientNumber]) {
        clientData[clientNumber] = { isQualified: false, botActive: true };
    }

    // Detectar mensagens enviadas manualmente pelo atendente humano e desativar o bot
    if (msg.fromMe && clientData[clientNumber].botActive) {
        clientData[clientNumber].botActive = false; // Desativa o bot
        await client.sendMessage(clientNumber, 'Bot desativado. Agora você está no controle da conversa. 😊');
        return;
    }

    // Verificar se o bot está desativado e não responder
    if (!clientData[clientNumber].botActive) return;

    // Fluxo inicial: Pergunta o nome
    if (msg.body.match(/(menu|oi|olá|ola|informações|quero saber mais|bom dia|boa tarde|boa noite|interessado|ajuda|funciona)/i)) {
        await delay(3000);
        clientData[clientNumber].step = 'askName';
        await client.sendMessage(msg.from, 'Olá! 😊 Eu sou a Sophya, sua assistente virtual da Trynitis. Como é seu nome?');
        return;
    }

    // Pergunta o nome e continua o fluxo
    if (clientData[clientNumber]?.step === 'askName') {
        const name = msg.body.split(' ')[0];
        clientData[clientNumber].name = name;
        clientData[clientNumber].step = 'askService';

        await delay(3000);
        await client.sendMessage(msg.from, `Prazer em te conhecer, ${name}! 😄 Sobre qual serviço você quer saber mais?
1 - Importação 🚢
2 - Recuperação Tributária 💰
3 - Projetos ESG 🌱
4 - Suporte ou Fale Conosco ✉️`);
        return;
    }

    // Escolha do serviço
    if (clientData[clientNumber]?.step === 'askService') {
        switch (msg.body) {
            case '1':
                clientData[clientNumber].step = 'importInfo';
                await client.sendMessage(msg.from, `Ótimo, ${clientData[clientNumber].name}! 🚀 Para começar, você já possui CNPJ ativo? Responda com "sim" ou "não".`);
                break;
            case '2':
                clientData[clientNumber].step = 'taxInfo';
                await client.sendMessage(msg.from, `Perfeito, ${clientData[clientNumber].name}. Sua empresa está no Lucro Presumido ou Lucro Real?`);
                break;
            case '3':
                clientData[clientNumber].step = 'esgInfo';
                await client.sendMessage(msg.from, `Legal, ${clientData[clientNumber].name}! 🌱 Por favor, descreva brevemente o seu interesse em projetos ESG.`);
                clientData[clientNumber].isQualified = true;
                break;
            case '4':
                await client.sendMessage(msg.from, `Você pode entrar em contato diretamente pelo e-mail: thiagopaccola@trynitis.com ✉️. Estamos à disposição!`);
                break;
            default:
                await client.sendMessage(msg.from, `Ops, ${clientData[clientNumber].name}, não entendi! 🤔 Por favor, digite 1, 2, 3 ou 4.`);
        }
        return;
    }

    // Informações de importação
    if (clientData[clientNumber]?.step === 'importInfo') {
        if (msg.body.toLowerCase() === 'não') {
            await client.sendMessage(msg.from, `Sem problemas, ${clientData[clientNumber].name}. Podemos conversar quando estiver pronto. 😉`);
            clientData[clientNumber].isQualified = true;
            return;
        }

        if (msg.body.toLowerCase() === 'sim') {
            clientData[clientNumber].step = 'askCNPJ';
            await client.sendMessage(msg.from, `Por favor, informe o CNPJ da sua empresa.`);
            return;
        }
    }

    if (clientData[clientNumber]?.step === 'askCNPJ') {
        if (!validarCNPJ(msg.body)) {
            await client.sendMessage(msg.from, `Parece que o CNPJ informado está incorreto. Por favor, insira novamente um CNPJ válido.`);
            return;
        }
        clientData[clientNumber].cnpj = msg.body;
        clientData[clientNumber].step = 'askSegment';
        await client.sendMessage(msg.from, `Ótimo, ${clientData[clientNumber].name}. Agora, qual segmento ou produto você pretende importar?`);
        return;
    }

    if (clientData[clientNumber]?.step === 'askSegment') {
        clientData[clientNumber].segment = msg.body;
        clientData[clientNumber].step = 'askValue';
        await client.sendMessage(msg.from, `E qual valor você tem disponível para importação? Digite a letra correspondente:
A - R$150.000,00
B - R$200.000,00
C - R$300.000,00
D - R$500.000,00
E - Acima de R$1.000.000,00`);
        return;
    }

    if (clientData[clientNumber]?.step === 'askValue') {
        const valuesMap = {
            'a': 'R$150.000,00',
            'b': 'R$200.000,00',
            'c': 'R$300.000,00',
            'd': 'R$500.000,00',
            'e': 'Acima de R$1.000.000,00'
        };
        const value = valuesMap[msg.body.toLowerCase()];
        if (!value) {
            await client.sendMessage(msg.from, `Ops! Parece que você escolheu uma opção inválida. Vamos tentar de novo.`);
            return;
        }
        clientData[clientNumber].importValue = value;
        await client.sendMessage(msg.from, `Obrigado, ${clientData[clientNumber].name}! Recebemos todas as informações. Um atendente entrará em contato em breve. 😊`);
        clientData[clientNumber].isQualified = true;
        clientData[clientNumber].botActive = false; // Desativa o bot após finalizar o atendimento
        return;
    }

    // Informações de recuperação tributária
    if (clientData[clientNumber]?.step === 'taxInfo') {
        if (msg.body.toLowerCase() === 'simples nacional') {
            await client.sendMessage(msg.from, `Infelizmente, ${clientData[clientNumber].name}, não atendemos empresas no Simples Nacional. Mas você pode nos seguir no Instagram: www.instagram.com/_trynitis`);
            clientData[clientNumber].isQualified = true;
            clientData[clientNumber].botActive = false; // Desativa o bot após a resposta
            return;
        }
        clientData[clientNumber].taxRegime = msg.body;
        clientData[clientNumber].step = 'askCNPJTax';
        await client.sendMessage(msg.from, `Perfeito! Qual é o CNPJ da sua empresa?`);
        return;
    }

    if (clientData[clientNumber]?.step === 'askCNPJTax') {
        if (!validarCNPJ(msg.body)) {
            await client.sendMessage(msg.from, `Parece que o CNPJ informado está incorreto. Por favor, insira novamente um CNPJ válido.`);
            return;
        }
        clientData[clientNumber].cnpj = msg.body;
        clientData[clientNumber].step = 'askYears';
        await client.sendMessage(msg.from, `Quantos anos sua empresa está no regime ${clientData[clientNumber].taxRegime}?`);
        return;
    }

    if (clientData[clientNumber]?.step === 'askYears') {
        clientData[clientNumber].yearsInRegime = msg.body;
        clientData[clientNumber].step = 'askEmployees';
        await client.sendMessage(msg.from, `Quantos funcionários têm registrado neste CNPJ?`);
        return;
    }

    if (clientData[clientNumber]?.step === 'askEmployees') {
        clientData[clientNumber].employees = msg.body;
        clientData[clientNumber].step = 'askRecoveryExperience';
        await client.sendMessage(msg.from, `Sua empresa já realizou recuperação tributária anteriormente? Responda com sim ou não.`);
        return;
    }

    if (clientData[clientNumber]?.step === 'askRecoveryExperience') {
        clientData[clientNumber].taxRecoveryExperience = msg.body.toLowerCase();
        await client.sendMessage(msg.from, `Obrigado, ${clientData[clientNumber].name}! Recebemos todas as informações. Um atendente entrará em contato em breve. 😊`);
        clientData[clientNumber].isQualified = true;
        clientData[clientNumber].botActive = false; // Desativa o bot após finalizar o atendimento
        return;
    }
});
npm init -y
{
  "name": "meu-chatbot",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}

