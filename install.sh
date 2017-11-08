#!/bin/bash


echo "initializing..."

# make sure that the required programs are installed
if command -v node >/dev/null 2>&1 ; then
    echo "node found version: $(node -v)"
else
    echo -e "\e[31mnode.js is required, ending...\e[39m"
    exit
fi

if command -v mysql >/dev/null 2>&1 ; then
    echo "mysql found version: $(mysql -V)"
else
    echo -e "\e[31mmysql is required, ending...\e[39m"
    exit
fi

npm install


echo -n "SQL root username(): "
read rootUser
echo -n "SQL root password(): "
read rootPass

echo -n "Database username(cis3750_node): "
read DBUSERNAME
echo -n "Database password(team31): "
read DBPASSWORD

echo -n "Database host(localhost): "
read DBHOST

echo -n "Database name(cis3750): "
read DBNAME

echo ""
echo -n "Database testing username(cis3750_node_test): "
read DBUSERNAME_TEST
echo -n "Database testing password(team31): "
read DBPASSWORD_TEST

echo -n "Database testing name(cis3750_test): "
read DBNAME_TEST

if [[ -z "$DBHOST" ]]; then
    DBHOST="localhost"
fi

if [[ -z "$DBUSERNAME" ]]; then
    DBUSERNAME="cis3750_node"
fi

if [[ -z "$DBPASSWORD" ]]; then
    DBPASSWORD="team31"
fi

if [[ -z "$DBNAME" ]]; then
    DBNAME="cis3750"
fi

if [[ -z "$DBUSERNAME_TEST" ]]; then
    DBUSERNAME_TEST="cis3750_node_test"
fi

if [[ -z "$DBPASSWORD_TEST" ]]; then
    DBPASSWORD_TEST="team31"
fi

if [[ -z "$DBNAME_TEST" ]]; then
    DBNAME_TEST="cis3750_test"
fi

# replace the username and password in the script with the ones given here

# create production database
TEMP=`mktemp` || exit 1
sed -e "s/{{USERNAME}}/$DBUSERNAME/g" -e "s/{{PASSWORD}}/$DBPASSWORD/g"  -e "s/{{DATABASE}}/$DBNAME/g" script.sql > $TEMP
cat $TEMP
mysql -u $rootUser --host $DBHOST -p$rootPass < $TEMP

# create test database
TEMP=`mktemp` || exit 1
sed -e "s/{{USERNAME}}/$DBUSERNAME_TEST/g" -e "s/{{PASSWORD}}/$DBPASSWORD_TEST/g"  -e "s/{{DATABASE}}/$DBNAME_TEST/g" script.sql > $TEMP
cat $TEMP
mysql -u $rootUser --host $DBHOST -p$rootPass < $TEMP


# check and create the init.d script here
