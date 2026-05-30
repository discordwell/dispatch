dispatch.discordwell.com {
	encode zstd gzip
	root * /opt/dispatch/site

	# Vite emits content-hashed assets → cache forever, immutable.
	@hashed path /assets/*
	header @hashed Cache-Control "public, max-age=31536000, immutable"

	# index.html references the new hashes each build → must revalidate.
	@html path / *.html
	header @html Cache-Control "no-cache"

	try_files {path} /index.html
	file_server

	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "SAMEORIGIN"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}
