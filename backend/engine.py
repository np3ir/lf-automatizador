import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import vlc
from mutagen import File as MutagenFile

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app)

vlc_instance = vlc.Instance()
player = vlc_instance.media_player_new()
player.audio_set_volume(50) # Volumen inicial al 50%

@app.route('/play', methods=['POST'])
def play():
    data = request.json
    ruta = data.get('ruta')
    if ruta:
        media = vlc_instance.media_new(ruta)
        player.set_media(media)
        player.play()
        return jsonify({"status": "Reproduciendo", "ruta": ruta})
    elif player.get_state() == vlc.State.Paused:
        player.play()
        return jsonify({"status": "Reanudado"})
    return jsonify({"error": "No hay ruta"}), 400

@app.route('/pause', methods=['POST'])
def pause():
    player.pause()
    return jsonify({"status": "Pausado"})

@app.route('/stop', methods=['POST'])
def stop():
    player.stop()
    return jsonify({"status": "Detenido"})

@app.route('/metadata', methods=['POST'])
def metadata():
    ruta = request.json.get('ruta')
    duracion = 0
    try:
        audio = MutagenFile(ruta)
        if audio and audio.info:
            duracion = int(audio.info.length)
    except Exception as e:
        pass
    return jsonify({"duracion": duracion})

@app.route('/status', methods=['GET'])
def status():
    estado = str(player.get_state())
    tiempo_ms = player.get_time()
    return jsonify({"estado": estado, "tiempo": tiempo_ms})

# NUEVO: Control de Volumen
@app.route('/volume', methods=['POST'])
def volume():
    vol = request.json.get('volume', 50)
    player.audio_set_volume(int(vol))
    return jsonify({"status": "Volumen ajustado", "volume": vol})

if __name__ == '__main__':
    print("Motor Python Iniciado")
    app.run(port=5000, debug=False)