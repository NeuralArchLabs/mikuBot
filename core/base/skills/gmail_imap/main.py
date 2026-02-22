import imaplib
import email
from email.header import decode_header
import json
import sys
import io

# Asegurar que la salida use UTF-8 para evitar errores de codificación en Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def decode_mime_words(s):
    """Auxiliar para decodificar asuntos y nombres con caracteres especiales."""
    try:
        parts = decode_header(s)
        decoded_string = ""
        for part, encoding in parts:
            if isinstance(part, bytes):
                decoded_string += part.decode(encoding or "utf-8", errors="ignore")
            else:
                decoded_string += part
        return decoded_string
    except:
        return str(s)

def get_body(msg):
    """Extrae el texto plano del cuerpo de un mensaje, manejando multipartes."""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdisp = str(part.get("Content-Disposition"))
            if ctype == "text/plain" and "attachment" not in cdisp:
                return part.get_payload(decode=True).decode(errors="ignore")
    else:
        return msg.get_payload(decode=True).decode(errors="ignore")
    return "[Cuerpo no disponible en formato texto plano]"

def process_gmail(email_user, app_password, action="list", query=None, limit=5):
    try:
        # Conexión al servidor IMAP de Gmail
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(email_user, app_password)
        mail.select("INBOX")

        if action == "search" and query:
            # Búsqueda avanzada (ej: FROM "Amazon" o SUBJECT "Factura")
            # Convertimos query simple a formato IMAP si no trae prefijo
            search_criteria = query if any(x in query.upper() for x in ["FROM", "SUBJECT", "BODY", "TEXT"]) else f'TEXT "{query}"'
            status, messages = mail.search(None, search_criteria)
        else:
            # Listado por defecto: los más recientes
            status, messages = mail.search(None, "ALL")

        if status != "OK" or not messages[0]:
            mail.logout()
            return {"success": True, "message": "No se encontraron correos para esta solicitud.", "emails": []}

        email_ids = messages[0].split()
        # Tomar los últimos 'limit' correos (los más recientes)
        subset_ids = email_ids[-limit:] if len(email_ids) > limit else email_ids
        subset_ids.reverse() # De más reciente a más viejo

        results = []
        for e_id in subset_ids:
            res, msg_data = mail.fetch(e_id, "(RFC822)")
            if res != "OK": continue

            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            subject = decode_mime_words(msg.get("Subject", "(Sin Asunto)"))
            sender = decode_mime_words(msg.get("From", "(Desconocido)"))
            date = msg.get("Date", "")
            snippet = get_body(msg)[:280].strip().replace("\n", " ") + "..."

            results.append({
                "id": e_id.decode(),
                "from": sender,
                "subject": subject,
                "date": date,
                "snippet": snippet
            })

        mail.logout()
        return {
            "success": True, 
            "message": f"Se recuperaron {len(results)} correos con éxito.",
            "emails": results
        }

    except imaplib.IMAP4.error as e:
        return {"success": False, "error": f"Error de autenticación o IMAP: {str(e)}. Verifica tu contraseña de aplicación."}
    except Exception as e:
        return {"success": False, "error": f"Error inesperado: {str(e)}"}

if __name__ == "__main__":
    try:
        # Leer argumentos pasados por Miku
        if len(sys.argv) < 2:
            print(json.dumps({"success": False, "error": "No se proporcionaron credenciales."}))
            sys.exit(1)

        input_data = json.loads(sys.argv[1])
        email_addr = input_data.get("email")
        password = input_data.get("app_password")
        action = input_data.get("action", "list")
        query = input_data.get("query")
        limit = input_data.get("limit", 5)

        if not email_addr or not password:
             print(json.dumps({"success": False, "error": "Faltan 'email' o 'app_password'."}))
             sys.exit(1)

        result = process_gmail(email_addr, password, action, query, limit)
        # Imprimir resultado en JSON limpio para el agente
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": f"Error fatal en el script: {str(e)}"}))
