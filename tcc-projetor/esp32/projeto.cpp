#include <WiFi.h>
#include <HTTPClient.h>

// 🧠 Pinos dos sensores ultrassônicos e da bomba
const int trigPin1 = 5;
const int echoPin1 = 18;
const int trigPin2 = 19;
const int echoPin2 = 21;
const int bomba1Pin = 26; // Pino da bomba

// ==== CONFIGURAÇÕES DE REDE ====
// 🌐 Wi-Fi (use sua rede 2.4 GHz!)
const char* ssid = "RecepitorXiaome";      // nome da sua rede Wi-Fi
const char* password = "arrezeb1";          // senha da sua rede Wi-Fi

// 🖥️ Endereço do seu servidor backend (seu PC ou URL em nuvem)
const char* serverUrl = "http://192.168.31.176:3000"; // ✅ Altere para o IP do PC ou URL da nuvem

#define SOUND_SPEED 0.034

// 📏 Altura total dos reservatórios em centímetros (Ajuste para o tamanho real!)
const float ALTURA_CAIXA_1 = 100.0;
const float ALTURA_CAIXA_2 = 100.0;

float distanceCm1, distanceCm2;
unsigned long lastSend = 0;
const unsigned long sendInterval = 5000; // Enviar dados a cada 5 segundos

void setup() {
  Serial.begin(115200);

  // Configura pinos dos sensores e da bomba
  pinMode(trigPin1, OUTPUT);
  pinMode(echoPin1, INPUT);
  pinMode(trigPin2, OUTPUT);
  pinMode(echoPin2, INPUT);
  pinMode(bomba1Pin, OUTPUT);
  digitalWrite(bomba1Pin, LOW);

  // Conecta ao Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ Conectado ao Wi-Fi!");
  Serial.print("Endereço IP do ESP32: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Mede a distância das duas caixas
  distanceCm1 = lerSensor(trigPin1, echoPin1);
  distanceCm2 = lerSensor(trigPin2, echoPin2);

  // Envia dados e checa bomba a cada 5 segundos
  if (millis() - lastSend > sendInterval) {
    enviarLeituras(distanceCm1, distanceCm2);
    checarComandoBomba();
    lastSend = millis();
  }

  delay(200);
}

// 📏 Lê a distância no sensor ultrassônico (em cm)
float lerSensor(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return 0;
  return (duration * SOUND_SPEED) / 2.0;
}

// 📊 Converte a distância lida em porcentagem do volume útil
float calcularPorcentagem(float distanciaCm, float alturaTotalCm) {
  if (distanciaCm <= 0) return 0;
  if (distanciaCm >= alturaTotalCm) return 0;
  float porcentagem = ((alturaTotalCm - distanciaCm) / alturaTotalCm) * 100.0;
  return porcentagem;
}

// 🚀 Envia as porcentagens calculadas para o backend
void enviarLeituras(float c1, float c2) {
  if (WiFi.status() != WL_CONNECTED) return;

  float pct1 = calcularPorcentagem(c1, ALTURA_CAIXA_1); 
  float pct2 = calcularPorcentagem(c2, ALTURA_CAIXA_2);

  HTTPClient http;
  String url = String(serverUrl) + "/api/dados";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"caixa_id\": 1, \"caixa1\": " + String(pct1, 1) + ", \"caixa2\": " + String(pct2, 1) + ", \"bomba\": 0}";
  int httpCode = http.POST(payload);

  Serial.printf("📤 Enviando dados (%s): HTTP %d\n", payload.c_str(), httpCode);
  http.end();
}

// 💡 Verifica o estado da bomba retornado pelo backend
void checarComandoBomba() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverUrl) + "/api/bomba/status";
  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String resp = http.getString();
    Serial.println("📥 Resposta bomba: " + resp);

    // Extrai o valor do campo "bomba" no JSON simples ex: {"bomba":1}
    int pos = resp.indexOf("\"bomba\":");
    if (pos != -1) {
      int valor = resp.substring(pos + 8).toInt();
      digitalWrite(bomba1Pin, valor ? HIGH : LOW);
      Serial.printf("💧 Bomba %s\n", valor ? "LIGADA" : "DESLIGADA");
    }
  } else {
    Serial.printf("⚠️ Falha ao checar bomba: HTTP %d\n", httpCode);
  }
  http.end();
}