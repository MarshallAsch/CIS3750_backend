#!/bin/bash

prod=0


case "$1" in
    -h|--help)
        echo "This program will configure and start a node.js server"
        echo "./configure.sh [-h] [-p]"
        echo "    -h  will print this usafe message"
        echo "    -p  will configure the server for production"
        exit 0
        ;;
    -p|--production)
        prod=1
        ;;
esac



echo "initializing..."

echo ""
echo ""

# make sure that the required programs are installed
if command -v node >/dev/null 2>&1 ; then
    echo "node found version: $(node -v)"
else
    echo "\e[31mnode.js is required, ending...\e[39m"
    exit 1
fi

if command -v mysql >/dev/null 2>&1 ; then
    echo "mysql found version: $(mysql -V)"
else
    echo "\e[31mmysql is required, ending...\e[39m"
    exit 1
fi

echo ""
echo ""

# get the database access info for the production database
if [[ "$prod" -eq "1"  ]]; then

    # get the data from the user about the database from the user so
    # that they are not hard coded into the app or in version control
    echo -n "PortNumber (3000): "
    read PORT
    echo -n "Database host(localhost): "
    read DBHOST
    echo -n "Database name(cis3750): "
    read DBNAME
    echo -n "Database username(cis3750_node): "
    read DBUSERNAME
    echo -n "Database password(): "
    read DBPASSWORD


    if [[ -z "$PORT" ]]; then
        PORT="3000"
    fi

    if [[ -z "$DBHOST" ]]; then
        DBHOST="localhost"
    fi

    if [[ -z "$DBNAME" ]]; then
        DBNAME="cis3750"
    fi

    if [[ -z "$DBUSERNAME" ]]; then
        DBUSERNAME="cis3750_node"
    fi

    if [[ -z "$DBPASSWORD" ]]; then
        echo "Missing password, ending... "
        exit 1
    fi

    sed -e "s/{{PORT}}/$PORT/g"  \
    -e "s/{{DBHOST}}/$DBHOST/g"  \
    -e "s/{{DBNAME}}/$DBNAME/g" \
    -e "s/{{DBUSERNAME}}/$DBUSERNAME/g" \
    -e "s/{{DBPASSWORD}}/$DBPASSWORD/g" config.env.example > config.env

    DIR=`pwd`

    rm "${DIR}/sslcert/live/*"

    ln -s "/etc/letsencrypt/live/cis3750.marshallasch.ca/privkey.pem" "${DIR}/sslcert/live/server.key"
    ln -s "/etc/letsencrypt/live/cis3750.marshallasch.ca/fullchain.pem" "${DIR}/sslcert/live/server.crt"
fi


# get the database access info for the testing database
if [[ "$prod" -eq "0"  ]]; then
    echo -n "testing port (3001): "
    read PORT
    echo -n "Database host for testing (localhost): "
    read DBHOST
    echo -n "Database name for testing(cis3750_test): "
    read DBNAME
    echo -n "Database username for testing(cis3750_node_test): "
    read DBUSERNAME
    echo -n "Database password for testing(): "
    read DBPASSWORD

    if [[ -z "$PORT" ]]; then
        PORT="3001"
    fi

    if [[ -z "$DBHOST" ]]; then
        DBHOST="localhost"
    fi

    if [[ -z "$DBNAME" ]]; then
        DBNAME="cis3750_test"
    fi

    if [[ -z "$DBUSERNAME" ]]; then
        DBUSERNAME="cis3750_node_test"
    fi

    if [[ -z "$DBPASSWORD" ]]; then
        echo "Missing password, ending... "
        exit 1
    fi

    sed -e "s/{{PORT}}/$PORT/g"  \
    -e "s/{{DBHOST}}/$DBHOST/g"  \
    -e "s/{{DBNAME}}/$DBNAME/g" \
    -e "s/{{DBUSERNAME}}/$DBUSERNAME/g" \
    -e "s/{{DBPASSWORD}}/$DBPASSWORD/g" config.env.example > config.env

    DIR=`pwd`

    rm "${DIR}/sslcert/live/*"

    ln -s "${DIR}/sslcert/key.pem" "${DIR}/sslcert/live/server.key"
    ln -s "${DIR}/sslcert/certificate.pem" "${DIR}/sslcert/live/server.crt"

    node app.js
fi
