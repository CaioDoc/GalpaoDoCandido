const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.ready = false;
    this.qrCode = null; // Armazena a imagem do QR Code em base64
    this.status = 'disconnected';
  }

  async initialize() {
    if (this.client) return;

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: './whatsapp-session' }),
        puppeteer: { 
          headless: true, 
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
      });

      this.client.on('qr', async (qr) => {
        try {
          this.qrCode = await qrcode.toDataURL(qr);
          this.status = 'connecting';
          console.log('✅ QR Code gerado com sucesso');
        } catch (err) {
          console.error('Erro ao gerar QR Code:', err);
        }
      });

      this.client.on('ready', () => {
        console.log('✅ WhatsApp Web conectado!');
        this.ready = true;
        this.status = 'connected';
        this.qrCode = null;
      });

      this.client.on('disconnected', (reason) => {
        console.log('❌ WhatsApp desconectado:', reason);
        this.ready = false;
        this.status = 'disconnected';
        this.qrCode = null;
      });

      this.client.on('auth_failure', (msg) => {
        console.error('❌ Falha na autenticação:', msg);
        this.status = 'error';
      });

      await this.client.initialize();
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp:', error);
      this.status = 'error';
    }
  }

  async sendMessage(target, msg, imagePath, isGroup = false) {
    if (!this.ready) throw new Error('WhatsApp não está conectado');
    
    let chatId;
    if (isGroup) {
      let inviteCode = target;
      if (target.includes('chat.whatsapp.com/')) {
        const parts = target.split('chat.whatsapp.com/')[1];
        inviteCode = parts.startsWith('invite/') ? parts.substring(7) : parts;
        inviteCode = inviteCode.split('/')[0].split('?')[0].trim();
      }
      try {
        console.log(`🔗 Tentando entrar no grupo via convite com o código: "${inviteCode}"...`);
        chatId = await this.client.acceptInvite(inviteCode);
        console.log(`✅ Entrou no grupo com sucesso! JID: ${chatId}`);
      } catch (inviteError) {
        console.error('Erro ao aceitar convite do grupo:', inviteError);
        throw new Error('Não foi possível enviar a mensagem para o grupo. Verifique se o link de convite é válido e está ativo.');
      }
    } else {
      chatId = `${target.replace(/\D/g, '')}@c.us`;
    }

    if (imagePath) {
      const media = MessageMedia.fromFilePath(imagePath);
      await this.client.sendMessage(chatId, media, { caption: msg });
    } else {
      await this.client.sendMessage(chatId, msg);
    }
  }

  getStatus() {
    return { 
      status: this.status, 
      qrCode: this.qrCode, 
      ready: this.ready,
      timestamp: Date.now() // Força atualização no frontend
    };
  }
}

module.exports = new WhatsAppService();
