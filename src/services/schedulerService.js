const { getDb } = require('../db');
const whatsappService = require('./whatsappService');

/**
 * Starts the promotion background scheduler.
 * Runs every 60 seconds.
 */
function startScheduler() {
    console.log('⏰  Agendador de promoções do WhatsApp iniciado...');
    
    setInterval(async () => {
        // Only run scheduler if WhatsApp is ready
        if (!whatsappService.ready) {
            console.log('⏰ [Scheduler] Aguardando conexão ativa do WhatsApp...');
            return;
        }

        const db = getDb();
        const now = new Date();
        
        // Pad date and time numbers to 2 digits
        const pad = (n) => String(n).padStart(2, '0');
        const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        
        try {
            // Find all pending promotions scheduled for now or in the past
            const pendingPromos = db.prepare(
                "SELECT * FROM scheduled_promotions WHERE status = 'pending' AND scheduled_at <= ?"
            ).all(nowStr);
            
            if (pendingPromos.length > 0) {
                console.log(`⏰ [Scheduler] Encontradas ${pendingPromos.length} promoções agendadas para disparo.`);
            }

            for (const promo of pendingPromos) {
                console.log(`⏰ [Scheduler] Enviando promoção agendada ID: ${promo.id} para target: ${promo.target}...`);
                
                // Mark status as processing to prevent race conditions or double-sending
                db.prepare("UPDATE scheduled_promotions SET status = 'processing' WHERE id = ?").run(promo.id);
                
                try {
                    // Send the message via WhatsApp Web Client
                    await whatsappService.sendMessage(
                        promo.target,
                        promo.message,
                        promo.image_path,
                        promo.is_group === 1
                    );
                    
                    // Mark as successfully sent
                    db.prepare("UPDATE scheduled_promotions SET status = 'sent' WHERE id = ?").run(promo.id);
                    console.log(`✅ [Scheduler] Promoção agendada ID: ${promo.id} enviada com sucesso!`);
                } catch (sendError) {
                    console.error(`❌ [Scheduler] Falha ao enviar promoção agendada ID: ${promo.id}:`, sendError);
                    
                    // Mark as failed and store the error message for debugging
                    db.prepare(
                        "UPDATE scheduled_promotions SET status = 'failed', error_message = ? WHERE id = ?"
                    ).run(sendError.message || 'Erro de envio desconhecido.', promo.id);
                }
            }
        } catch (dbError) {
            console.error('❌ [Scheduler] Erro no banco de dados ao processar agendamentos:', dbError);
        }
    }, 60000); // 60 seconds
}

module.exports = {
    startScheduler
};
