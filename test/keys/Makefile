#
# Generate keys for tls.js tests.
#
# Derived from node/test/fixtures/keys/Makefile
#

all: server-cert.pem ca.pem

test: server-verify 

clean:
	rm -f *.pem *.srl *.csr


.PHONY: all clean test server-verify 


#
# Create Certificate Authority
#
ca.pem: ca.cnf
	openssl req -new -x509 -days 9999 -config ca.cnf -keyout ca-key.pem -out ca.pem


#
# Create server keys
#

server-key.pem:
	openssl genrsa -out server-key.pem

server-csr.pem: server.cnf server-key.pem
	openssl req -new -config server.cnf -key server-key.pem -out server-csr.pem

server-cert.pem: server-csr.pem ca.pem ca-key.pem
	openssl x509 -req \
		-days 9999 \
		-passin "pass:password" \
		-in server-csr.pem \
		-CA ca.pem \
		-CAkey ca-key.pem \
		-CAcreateserial \
		-out server-cert.pem

server-verify: ca.pem server-cert.pem
	openssl verify -CAfile ca.pem server-cert.pem
