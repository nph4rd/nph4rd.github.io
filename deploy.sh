currentDate=`date`
echo "###############################" >> hashes.txt
echo $currentDate >> hashes.txt
ipfs add -r . >> hashes.txt
git add -A
git commit -a -m 'Update ipfs hashes'
git push origin master

